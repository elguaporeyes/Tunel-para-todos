const { MESSAGE_TYPES } = require('@mitunel/common');
const controlPlaneClient = require('./services/controlPlaneClient');

class TunnelManager {
  constructor() {
    this.tunnels = new Map(); // subdomain -> Tunnel Object
    this.pendingRequests = new Map(); // requestId -> { res, timer, resolve, reject }

    // Tarea periódica de reporte de consumo (cada 30 segundos)
    this.usageFlushInterval = setInterval(() => this.flushAllUsage(), 30000);
    if (this.usageFlushInterval && this.usageFlushInterval.unref) {
      this.usageFlushInterval.unref();
    }
  }

  registerTunnel(subdomain, data) {
    if (this.tunnels.has(subdomain)) {
      const old = this.tunnels.get(subdomain);
      try {
        old.ws.close(1000, 'Reemplazado por nueva sesión');
      } catch (e) {}
    }

    const tunnel = {
      subdomain,
      ws: data.ws,
      userId: data.userId,
      apiKeyId: data.apiKeyId,
      isPremium: data.isPremium,
      weeklyCredits: data.weeklyCredits,
      requestsCount: 0,
      bytesTransferred: 0,
      unreportedRequests: 0,
      unreportedBytes: 0,
      connectedAt: new Date(),
    };

    this.tunnels.set(subdomain, tunnel);
    return tunnel;
  }

  getTunnel(subdomain) {
    return this.tunnels.get(subdomain);
  }

  removeTunnel(subdomain) {
    const tunnel = this.tunnels.get(subdomain);
    if (tunnel) {
      this.flushUsage(tunnel);
      this.tunnels.delete(subdomain);
    }
  }

  // Deducción y registro en tiempo real al completarse cada petición HTTP
  async recordRequestCompleted(subdomain, { bytesIn = 0, bytesOut = 0, clientIp = null } = {}) {
    const tunnel = this.tunnels.get(subdomain);
    if (!tunnel) {
      console.warn(`[Tunnel Metering Warning] No se encontró túnel activo para subdominio: "${subdomain}"`);
      return;
    }

    const totalBytes = bytesIn + bytesOut;
    tunnel.requestsCount += 1;
    tunnel.bytesTransferred += totalBytes;

    // Descontar en tiempo real: 1 crédito por cada petición HTTP procesada para usuarios Free
    const creditsToDeduct = tunnel.isPremium ? 0 : 1;

    console.log(
      `[Tunnel Metering] Subdominio "${subdomain}" procesó petición #${tunnel.requestsCount} (${totalBytes} bytes). Descontando ${creditsToDeduct} crédito(s)...`
    );

    try {
      const payload = {
        userId: tunnel.userId,
        apiKeyId: tunnel.apiKeyId,
        subdomain: tunnel.subdomain,
        requestsCount: 1,
        bytesTransferred: totalBytes,
        creditsToDeduct,
        clientIp,
      };

      const result = await controlPlaneClient.reportUsage(payload);

      if (result && result.success) {
        if (!tunnel.isPremium && typeof result.remainingCredits === 'number') {
          tunnel.weeklyCredits = result.remainingCredits;
          console.log(
            `[Tunnel Metering] Saldo actualizado para "${subdomain}": ${result.remainingCredits} créditos restantes.`
          );

          // Notificar al cliente CLI en tiempo real para actualizar su pantalla TUI
          if (tunnel.ws && tunnel.ws.readyState === tunnel.ws.OPEN) {
            tunnel.ws.send(
              JSON.stringify({
                type: MESSAGE_TYPES.CREDIT_UPDATE,
                remainingCredits: result.remainingCredits,
              })
            );
          }
        }

        if (result.isExhausted) {
          console.warn(`[Tunnel Manager] Saldo agotado para túnel "${tunnel.subdomain}". Interrumpiendo conexión.`);
          this.terminateForNoCredits(tunnel);
        }
      } else {
        console.error(`[Tunnel Metering Error] El Control Plane no pudo procesar el consumo:`, result);
      }
    } catch (err) {
      console.error(`[Tunnel Metering Exception] Error reportando consumo: ${err.message}`);
    }
  }

  // Compatibilidad hacia atrás
  recordRequest(subdomain, bytes) {
    const tunnel = this.tunnels.get(subdomain);
    if (!tunnel) return;
    tunnel.bytesTransferred += bytes;
  }

  async flushAllUsage() {
    // Sincronización periódica de seguridad
  }

  terminateForNoCredits(tunnel) {
    if (!tunnel || !tunnel.ws) return;

    try {
      tunnel.ws.send(
        JSON.stringify({
          type: MESSAGE_TYPES.TUNNEL_TERMINATED,
          reason: 'CREDITS_EXHAUSTED',
          message:
            '⚠️ Tus tokens gratuitos de la semana se han agotado. Para continuar publicando tus servicios localhost, actualiza a Premium aquí: https://mitunel.dev/pricing',
        })
      );
      tunnel.ws.close(4402, 'Credits Exhausted');
    } catch (e) {}

    this.tunnels.delete(tunnel.subdomain);
  }

  // Registro de petición HTTP en espera de respuesta del CLI
  registerPendingRequest(requestId, res, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Gateway Timeout esperando respuesta del CLI'));
      }, timeoutMs);

      this.pendingRequests.set(requestId, { res, timer, resolve, reject });
    });
  }

  resolvePendingRequest(requestId, responseData) {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return false;

    clearTimeout(pending.timer);
    this.pendingRequests.delete(requestId);
    pending.resolve(responseData);
    return true;
  }
}

module.exports = new TunnelManager();
