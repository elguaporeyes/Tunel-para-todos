const http = require('http');
const crypto = require('crypto');
const { MESSAGE_TYPES } = require('@mitunel/common');
const tunnelManager = require('./tunnelManager');

/**
 * Limpia y normaliza la URL para enviarla al servicio local, removiendo el prefijo /t/<subdominio>
 * o los parámetros de túnel (?tunnel= o ?_subdomain=) si fueron utilizados.
 *
 * @param {string} urlStr - URL recibida por el proxy
 * @param {string} subdomain - Subdominio del túnel activo
 * @returns {string} - URL limpia para el servidor local
 */
const stripTunnelFromUrl = (urlStr, subdomain) => {
  if (!urlStr) return '/';

  let cleaned = urlStr;
  const pathPrefix = `/t/${subdomain}`;

  // 1. Remover prefijo /t/<subdominio>
  if (cleaned === pathPrefix || cleaned === `${pathPrefix}/`) {
    cleaned = '/';
  } else if (cleaned.startsWith(`${pathPrefix}/`)) {
    cleaned = cleaned.slice(pathPrefix.length);
  } else if (cleaned.startsWith(`${pathPrefix}?`)) {
    cleaned = `/${cleaned.slice(pathPrefix.length)}`;
  } else if (cleaned.startsWith(`${pathPrefix}#`)) {
    cleaned = `/${cleaned.slice(pathPrefix.length)}`;
  }

  // 2. Remover parámetros de búsqueda ?tunnel= o ?_subdomain= si existen
  try {
    const urlObj = new URL(cleaned, 'http://localhost');
    let modified = false;

    if (urlObj.searchParams.has('tunnel')) {
      urlObj.searchParams.delete('tunnel');
      modified = true;
    }
    if (urlObj.searchParams.has('_subdomain')) {
      urlObj.searchParams.delete('_subdomain');
      modified = true;
    }

    if (modified) {
      const search = urlObj.searchParams.toString();
      cleaned = urlObj.pathname + (search ? `?${search}` : '') + (urlObj.hash || '');
    }
  } catch (e) {}

  return cleaned || '/';
};

/**
 * Extrae el subdominio del encabezado HTTP Host o X-Forwarded-Host considerando
 * peticiones directas, proxies inversos (Render, Cloudflare, etc.), rutas URL (/t/subdominio)
 * y parámetros (?tunnel=subdominio).
 *
 * @param {string|object} hostHeaderOrReq - Cadena Host o el objeto IncomingMessage (req)
 * @param {string} baseDomain - Dominio base configurado (ej: 'mitunel.dev')
 * @param {object} [req] - Objeto IncomingMessage opcional si se pasa el host como primer argumento
 * @returns {string|null} - Subdominio extraído en minúsculas, o null si es la raíz o no se encuentra
 */
const getSubdomainFromHost = (hostHeaderOrReq, baseDomain, req) => {
  let reqObj = null;
  let rawHost = '';

  if (hostHeaderOrReq && typeof hostHeaderOrReq === 'object' && hostHeaderOrReq.headers) {
    reqObj = hostHeaderOrReq;
  } else {
    rawHost = typeof hostHeaderOrReq === 'string' ? hostHeaderOrReq : '';
    reqObj = req || null;
  }

  if (reqObj) {
    const host = (reqObj.headers && (reqObj.headers['x-forwarded-host'] || reqObj.headers.host)) || rawHost || 'localhost';

    // 1. Extraer el ID del túnel desde Query Param (?tunnel=...) o desde la Ruta (/t/...)
    if (reqObj.url) {
      try {
        const parsedUrl = new URL(reqObj.url, `http://${host.split(',')[0].trim()}`);

        let tunnelId = parsedUrl.searchParams.get('tunnel');

        if (!tunnelId) {
          const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
          if (pathSegments[0] === 't' && pathSegments[1]) {
            tunnelId = pathSegments[1];
          }
        }

        if (!tunnelId) {
          tunnelId = parsedUrl.searchParams.get('_subdomain');
        }

        if (tunnelId && tunnelId.trim()) {
          return tunnelId.trim().toLowerCase();
        }
      } catch (e) {}
    }

    // 2. Si no viene en la URL, intentar por cabeceras explícitas (x-tunnel-id o x-tunnel-subdomain)
    if (reqObj.headers) {
      if (reqObj.headers['x-tunnel-id']) {
        return reqObj.headers['x-tunnel-id'].trim().toLowerCase();
      }
      if (reqObj.headers['x-tunnel-subdomain']) {
        return reqObj.headers['x-tunnel-subdomain'].trim().toLowerCase();
      }
    }
  }

  // 4. Prioridad: Encabezado Host o X-Forwarded-Host (para dominios con DNS wildcard propio)
  if (reqObj && reqObj.headers) {
    const xForwardedHost = reqObj.headers['x-forwarded-host'];
    if (xForwardedHost) {
      rawHost = xForwardedHost.split(',')[0].trim();
    } else if (!rawHost && reqObj.headers.host) {
      rawHost = reqObj.headers.host;
    }
  }

  if (rawHost) {
    const cleanHost = rawHost.split(':')[0].trim().toLowerCase();
    const cleanBase = (baseDomain || 'mitunel.dev').split(':')[0].trim().toLowerCase();

    // Descartar dominio raíz o direcciones locales/Render sin subdominio
    const isRootOrDirect =
      cleanHost === cleanBase ||
      cleanHost === 'localhost' ||
      cleanHost === '127.0.0.1' ||
      cleanHost === 'mitunel-proxy.onrender.com' ||
      (cleanHost.endsWith('.onrender.com') && cleanHost.split('.').length <= 3);

    if (!isRootOrDirect) {
      // Subdominio sobre el dominio base configurado (ej: myapp.mitunel.dev -> myapp)
      if (cleanHost.endsWith(`.${cleanBase}`)) {
        const sub = cleanHost.slice(0, -(cleanBase.length + 1));
        if (sub) return sub;
      }

      // Subdominio sobre mitunel-proxy.onrender.com (si existiera DNS wildcard)
      if (cleanHost.endsWith('.mitunel-proxy.onrender.com')) {
        const sub = cleanHost.slice(0, -'.mitunel-proxy.onrender.com'.length);
        if (sub) return sub;
      }

      // Subdominio para pruebas en local (ej: test.localhost -> test)
      if (cleanHost.endsWith('.localhost')) {
        const sub = cleanHost.slice(0, -'.localhost'.length);
        if (sub) return sub;
      }
    }
  }

  // 5. Fallback: Encabezado Referer (para assets como /styles.css, /bundle.js solicitados desde /t/<subdomain>)
  if (reqObj && reqObj.headers && reqObj.headers.referer) {
    try {
      const refUrl = new URL(reqObj.headers.referer);
      const pathMatch = refUrl.pathname.match(/^\/t\/([a-zA-Z0-9_-]+)(?:\/|\?|#|$)/i);
      if (pathMatch && pathMatch[1]) {
        return pathMatch[1].trim().toLowerCase();
      }
      if (refUrl.searchParams.has('tunnel')) {
        const val = refUrl.searchParams.get('tunnel');
        if (val && val.trim()) return val.trim().toLowerCase();
      }
    } catch (e) {}
  }

  // 6. Fallback: Cookie de túnel previa (permite navegación interna en apps sin subdominio)
  if (reqObj && reqObj.headers && reqObj.headers.cookie) {
    const match = reqObj.headers.cookie.match(/(?:^|;\s*)mitunel_tunnel=([a-zA-Z0-9_-]+)/i);
    if (match && match[1]) {
      // No usar cookie si la petición es intencionalmente a la raíz / sin referer (ej. abrir la home del gateway)
      const isGatewayRoot = (reqObj.url === '/' || reqObj.url === '') && !reqObj.headers.referer;
      if (!isGatewayRoot) {
        return match[1].trim().toLowerCase();
      }
    }
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

    const subdomain = getSubdomainFromHost(req, baseDomain);

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

      // Limpiar URL para que el servidor local reciba la ruta original (/ en lugar de /t/355fbe6c)
      const targetUrl = stripTunnelFromUrl(req.url, subdomain);

      // Preparar payload para enviar por WebSocket al CLI
      const requestPayload = {
        type: MESSAGE_TYPES.HTTP_REQUEST,
        id: requestId,
        method: req.method,
        url: targetUrl,
        headers: req.headers,
        body: bodyBuffer.toString('base64'),
      };

      try {
        // Registrar en espera y enviar al socket del CLI
        const responsePromise = tunnelManager.registerPendingRequest(requestId, res, 30000);
        tunnel.ws.send(JSON.stringify(requestPayload));

        // Esperar la respuesta del CLI
        const responseData = await responsePromise;

        // Inyectar cookie de túnel para que peticiones subsiguientes de assets (/main.js, /style.css) encuentren el túnel
        const finalHeaders = { ...(responseData.headers || {}) };
        const tunnelCookie = `mitunel_tunnel=${subdomain}; Path=/; SameSite=Lax`;
        const existingCookie = finalHeaders['set-cookie'];
        if (!existingCookie) {
          finalHeaders['set-cookie'] = [tunnelCookie];
        } else if (Array.isArray(existingCookie)) {
          finalHeaders['set-cookie'] = [...existingCookie, tunnelCookie];
        } else {
          finalHeaders['set-cookie'] = [existingCookie, tunnelCookie];
        }

        // Escribir cabeceras de respuesta al cliente HTTP
        res.writeHead(responseData.statusCode, finalHeaders);

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
  stripTunnelFromUrl,
};
