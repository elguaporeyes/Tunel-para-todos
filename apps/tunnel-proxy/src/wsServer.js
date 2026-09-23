const { WebSocketServer } = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');
const { MESSAGE_TYPES, ERROR_CODES } = require('@mitunel/common');
const controlPlaneClient = require('./services/controlPlaneClient');
const tunnelManager = require('./tunnelManager');

const setupWebSocketServer = (server) => {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', async (ws, req, validationResult) => {
    const { subdomain, userId, apiKeyId, isPremium, weeklyCredits } = validationResult;

    console.log(`[WS Server] Túnel establecido para subdominio: "${subdomain}" (Premium: ${isPremium})`);

    const tunnel = tunnelManager.registerTunnel(subdomain, {
      ws,
      userId,
      apiKeyId,
      isPremium,
      weeklyCredits,
    });

    const baseDomain = process.env.BASE_DOMAIN || 'mitunel.dev';
    const protocol = process.env.PUBLIC_PROTOCOL || 'http';
    let publicUrl;

    if (baseDomain.includes('onrender.com') || process.env.RENDER === 'true') {
      // En Render (*.onrender.com), no hay wildcard DNS para subdominios dinámicos (Error 1016 en Cloudflare).
      // Generamos la URL pública en formato de ruta directa segura: https://mitunel-proxy.onrender.com/t/<subdomain>
      const cleanBase = baseDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      publicUrl = `https://${cleanBase}/t/${subdomain}`;
    } else {
      publicUrl = `${protocol}://${subdomain}.${baseDomain}`;
    }

    // Confirmar conexión exitosa al CLI
    ws.send(
      JSON.stringify({
        type: MESSAGE_TYPES.AUTH_SUCCESS,
        subdomain,
        publicUrl,
        isPremium,
        weeklyCredits,
      })
    );

    // Heartbeat ping
    const pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      }
    }, 20000);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === MESSAGE_TYPES.HTTP_RESPONSE) {
          tunnelManager.resolvePendingRequest(message.id, message);
        } else if (message.type === MESSAGE_TYPES.PONG) {
          // Heartbeat pong recibido
        }
      } catch (err) {
        console.error(`[WS Server] Error procesando mensaje de túnel ${subdomain}: ${err.message}`);
      }
    });

    ws.on('close', (code, reason) => {
      clearInterval(pingInterval);
      console.log(`[WS Server] Túnel cerrado: ${subdomain} (Código: ${code}, Razón: ${reason})`);
      tunnelManager.removeTunnel(subdomain);
    });

    ws.on('error', (err) => {
      console.error(`[WS Server] Error en socket ${subdomain}: ${err.message}`);
    });
  });

  return {
    handleUpgrade: async (req, socket, head) => {
      const parsedUrl = url.parse(req.url, true);

      if (parsedUrl.pathname !== '/tunnel') {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      const token = parsedUrl.query.token;
      const requestedSubdomain = parsedUrl.query.subdomain;

      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Validación previa de firma JWT con JWT_SECRET
      if (token.startsWith('eyJ')) {
        try {
          const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production_mitunel_2026';
          jwt.verify(token, secret);
        } catch (jwtErr) {
          console.warn(`[WS Server] Firma JWT rechazada en proxy: ${jwtErr.message}`);
          const body = JSON.stringify({
            error: 'Unauthorized',
            reason: 'INVALID_JWT_SIGNATURE',
            message: `Firma JWT inválida o token expirado (${jwtErr.message}). Verifica que JWT_SECRET coincida entre control-plane y tunnel-proxy.`,
          });
          socket.write(
            `HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
          );
          socket.destroy();
          return;
        }
      }

      // Validar con el Control Plane (créditos, suscripción y subdominio)
      const { status, data } = await controlPlaneClient.validateTunnel(token, requestedSubdomain);

      if (status !== 200 || !data.allowed) {
        // Enviar respuesta HTTP personalizada antes de abortar el handshake
        if (status === 402 || data.reason === ERROR_CODES.CREDITS_EXHAUSTED) {
          const body = JSON.stringify({
            error: 'Payment Required',
            reason: ERROR_CODES.CREDITS_EXHAUSTED,
            message: data.message,
            pricingUrl: process.env.PRICING_URL || 'https://mitunel.dev/pricing',
          });
          socket.write(
            `HTTP/1.1 402 Payment Required\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
          );
        } else if (status === 401) {
          const body = JSON.stringify({
            error: 'Unauthorized',
            reason: data?.reason || 'UNAUTHORIZED',
            message: data?.message || 'Token de autenticación no válido',
          });
          socket.write(
            `HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
          );
        } else if (status === 403) {
          const body = JSON.stringify({
            error: 'Forbidden',
            reason: data?.reason || 'FORBIDDEN',
            message: data?.message || 'Acceso denegado por el Control Plane (verifica INTERNAL_API_KEY)',
          });
          socket.write(
            `HTTP/1.1 403 Forbidden\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
          );
        } else {
          const body = JSON.stringify({
            error: 'Bad Request',
            reason: data?.reason || 'BAD_REQUEST',
            message: data?.message || 'Error en validación de túnel',
          });
          socket.write(
            `HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
          );
        }
        socket.destroy();
        return;
      }

      // Si todo es válido, realizar el upgrade WebSocket
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req, data);
      });
    },
  };
};

module.exports = setupWebSocketServer;
