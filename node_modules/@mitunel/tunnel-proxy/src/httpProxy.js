const http = require('http');
const crypto = require('crypto');
const { MESSAGE_TYPES } = require('@mitunel/common');
const tunnelManager = require('./tunnelManager');

const getSubdomainFromHost = (hostHeader, baseDomain, req) => {
  if (req && req.headers && req.headers['x-tunnel-subdomain']) {
    return req.headers['x-tunnel-subdomain'].trim().toLowerCase();
  }
  if (req && req.url) {
    try {
      const urlObj = new URL(req.url, 'http://localhost');
      if (urlObj.searchParams.has('_subdomain')) {
        return urlObj.searchParams.get('_subdomain').trim().toLowerCase();
      }
    } catch (e) {}
  }
  if (!hostHeader) return null;
  // Limpiar puerto si existe (ej. xyz.mitunel.dev:8080 -> xyz.mitunel.dev)
  const cleanHost = hostHeader.split(':')[0].toLowerCase();
  const cleanBase = baseDomain.split(':')[0].toLowerCase();

  // Si es el dominio base configurado, localhost o dominio raíz directo de Render
  if (
    cleanHost === cleanBase ||
    cleanHost === 'localhost' ||
    cleanHost === '127.0.0.1' ||
    cleanHost === 'mitunel-proxy.onrender.com' ||
    (cleanHost.endsWith('.onrender.com') && cleanHost.split('.').length <= 3)
  ) {
    return null; // Es el dominio raíz
  }

  if (cleanHost.endsWith(`.${cleanBase}`)) {
    return cleanHost.slice(0, -(cleanBase.length + 1));
  }

  if (cleanHost.endsWith('.mitunel-proxy.onrender.com')) {
    return cleanHost.slice(0, -'.mitunel-proxy.onrender.com'.length);
  }

  // Si se prueba en local con cabeceras directas o subdominios localhost (ej: test.localhost)
  if (cleanHost.endsWith('.localhost')) {
    return cleanHost.slice(0, -'.localhost'.length);
  }

  return null;
};

// Generador de respuestas HTML elegantes para errores de túnel
const renderTunnelErrorPage = (statusCode, title, description, badgeText, ctaUrl = null, ctaText = null) => {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusCode} - ${title}</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(18, 24, 38, 0.85);
      --border: rgba(255, 255, 255, 0.1);
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --warning: #f59e0b;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body {
      background: var(--bg);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
      background-image: radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.15) 0%, transparent 60%);
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2.5rem;
      max-width: 540px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(12px);
    }
    .badge {
      display: inline-block;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1.25rem;
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    .badge-warning {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border-color: rgba(245, 158, 11, 0.3);
    }
    h1 { font-size: 1.85rem; margin-bottom: 0.75rem; font-weight: 700; color: #fff; }
    p { color: var(--text-muted); font-size: 1rem; line-height: 1.6; margin-bottom: 2rem; }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: #fff;
      text-decoration: none;
      font-weight: 600;
      padding: 0.85rem 1.75rem;
      border-radius: 10px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.4);
    }
    .btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(59, 130, 246, 0.6); }
    .footer { margin-top: 2rem; font-size: 0.8rem; color: #64748b; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 1.25rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge ${statusCode === 402 ? 'badge-warning' : ''}">${badgeText}</div>
    <h1>${title}</h1>
    <p>${description}</p>
    ${ctaUrl ? `<a href="${ctaUrl}" class="btn" target="_blank">${ctaText || 'Actualizar a Premium'}</a>` : ''}
    <div class="footer">Servicio de Tunelización MiTunel Edge Gateway &bull; HTTP ${statusCode}</div>
  </div>
</body>
</html>`;
};

const createHttpProxyHandler = (baseDomain, pricingUrl) => {
  return async (req, res) => {
    // Endpoint de Health Check
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(
        JSON.stringify({
          status: 'ok',
          service: 'mitunel-tunnel-proxy',
          timestamp: new Date().toISOString(),
          activeTunnels: tunnelManager.tunnels.size,
        })
      );
    }

    const subdomain = getSubdomainFromHost(req.headers.host, baseDomain, req);

    // Si es la raíz del dominio o no hay subdominio especificado
    if (!subdomain) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(
        renderTunnelErrorPage(
          200,
          'MiTunel Gateway Activo',
          'El servidor proxy de túneles está en funcionamiento. Conecta tu cliente CLI ejecutando <code>mitunel http &lt;puerto&gt;</code> para exponer tu servidor local.',
          'Gateway Online',
          pricingUrl,
          'Ver Planes y Precios'
        )
      );
    }

    // Buscar si existe un túnel WebSocket activo para este subdominio
    const tunnel = tunnelManager.getTunnel(subdomain);

    if (!tunnel) {
      res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(
        renderTunnelErrorPage(
          502,
          'Túnel No Encontrado',
          `No existe ningún túnel activo escuchando en el subdominio <strong>${subdomain}</strong>. Asegúrate de que tu cliente CLI esté conectado.`,
          'Túnel Desconectado'
        )
      );
    }

    // Validación de Saldo en tiempo real
    if (!tunnel.isPremium && tunnel.weeklyCredits <= 0) {
      res.writeHead(402, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(
        renderTunnelErrorPage(
          402,
          'Créditos Agotados (Payment Required)',
          'Tus créditos gratuitos de la semana se han agotado. Para continuar recibiendo tráfico público hacia tu servicio local, suscríbete al plan Premium con ancho de banda y conexiones ilimitadas.',
          'Saldo Agotado',
          pricingUrl,
          'Desbloquear Tráfico Ilimitado con Premium'
        )
      );
    }

    // Leer el body de la petición HTTP entrante
    const bodyChunks = [];
    req.on('data', (chunk) => bodyChunks.push(chunk));

    req.on('end', async () => {
      const bodyBuffer = Buffer.concat(bodyChunks);
      const requestId = crypto.randomUUID();

      // Preparar payload para enviar por WebSocket al CLI
      const requestPayload = {
        type: MESSAGE_TYPES.HTTP_REQUEST,
        id: requestId,
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: bodyBuffer.toString('base64'),
      };

      try {
        // Registrar en espera y enviar al socket del CLI
        const responsePromise = tunnelManager.registerPendingRequest(requestId, res, 30000);
        tunnel.ws.send(JSON.stringify(requestPayload));

        // Esperar la respuesta del CLI
        const responseData = await responsePromise;

        // Escribir cabeceras de respuesta al cliente HTTP
        res.writeHead(responseData.statusCode, responseData.headers);

        const resBodyBuffer = responseData.body ? Buffer.from(responseData.body, 'base64') : Buffer.alloc(0);
        res.end(resBodyBuffer);

        // Contabilizar y descontar créditos en tiempo real una vez completada la entrega al cliente público
        tunnelManager
          .recordRequestCompleted(subdomain, {
            bytesIn: bodyBuffer.length,
            bytesOut: resBodyBuffer.length,
            clientIp: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
          })
          .catch((meteringErr) => {
            console.error(`[Metering Catch Error]: ${meteringErr.message}`);
          });
      } catch (err) {
        if (!res.headersSent) {
          res.writeHead(504, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(
            renderTunnelErrorPage(
              504,
              'Gateway Timeout',
              `El cliente local conectado al túnel <strong>${subdomain}</strong> no respondió a tiempo: ${err.message}`,
              'Tiempo de Espera Excedido'
            )
          );
        }
      }
    });

    req.on('error', (err) => {
      console.error(`[HTTP Proxy Error]: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error interno en el Edge Proxy');
      }
    });
  };
};

module.exports = {
  createHttpProxyHandler,
  getSubdomainFromHost,
};
