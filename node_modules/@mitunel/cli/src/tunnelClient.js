const WebSocket = require('ws');
const http = require('http');
const { MESSAGE_TYPES, ERROR_CODES } = require('@mitunel/common');
const ui = require('./ui');

const startTunnel = (options) => {
  const { serverUrl, token, localPort, requestedSubdomain, pricingUrl } = options;

  let wsUrl = `${serverUrl}/tunnel?token=${encodeURIComponent(token)}`;
  if (requestedSubdomain) {
    wsUrl += `&subdomain=${encodeURIComponent(requestedSubdomain)}`;
  }

  const ws = new WebSocket(wsUrl);

  // Keep-alive: enviar ping cada 30 segundos para evitar que servicios en la
  // nube (Render, Heroku, etc.) cierren la conexión WebSocket por inactividad.
  let keepAliveInterval = null;

  const clearKeepAlive = () => {
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
  };

  ws.on('open', () => {
    // Iniciar ping periódico al abrirse la conexión
    keepAliveInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);
  });

  ws.on('pong', () => {
    // Heartbeat confirmado por el servidor proxy
  });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case MESSAGE_TYPES.AUTH_SUCCESS: {
          ui.setSession({
            publicUrl: msg.publicUrl,
            localPort,
            subdomain: msg.subdomain,
            isPremium: msg.isPremium,
            weeklyCredits: msg.weeklyCredits,
          });
          break;
        }

        case MESSAGE_TYPES.HTTP_REQUEST: {
          handleIncomingHttpRequest(ws, msg, localPort);
          break;
        }

        case MESSAGE_TYPES.CREDIT_UPDATE: {
          ui.updateCredits(msg.remainingCredits);
          break;
        }

        case MESSAGE_TYPES.TUNNEL_TERMINATED: {
          if (msg.reason === ERROR_CODES.CREDITS_EXHAUSTED) {
            ui.showCreditsExhaustedAlert(pricingUrl);
            process.exit(1);
          } else {
            console.log(`\n[MiTunel] Conexión terminada: ${msg.message || msg.reason}`);
            process.exit(0);
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('[MiTunel Error procesando mensaje]', err.message);
    }
  });

  ws.on('unexpected-response', (req, res) => {
    let rawBody = '';
    res.on('data', (chunk) => (rawBody += chunk));
    res.on('end', () => {
      try {
        const errorData = JSON.parse(rawBody);
        if (res.statusCode === 402 || errorData.reason === ERROR_CODES.CREDITS_EXHAUSTED) {
          ui.showCreditsExhaustedAlert(errorData.pricingUrl || pricingUrl);
        } else if (res.statusCode === 401) {
          ui.showAuthError('El API Token configurado no es válido o ha expirado.');
        } else {
          console.error(`\n❌ Error del servidor (${res.statusCode}): ${errorData.message || res.statusMessage}`);
        }
      } catch (e) {
        if (res.statusCode === 402) {
          ui.showCreditsExhaustedAlert(pricingUrl);
        } else {
          console.error(`\n❌ Error del servidor (${res.statusCode}): ${res.statusMessage}`);
        }
      }
      process.exit(1);
    });
  });

  ws.on('close', (code, reason) => {
    clearKeepAlive();
    if (code === 4402) {
      ui.showCreditsExhaustedAlert(pricingUrl);
    } else if (code !== 1000) {
      console.log(`\n🔌 Conexión con el servidor proxy cerrada (Código: ${code})`);
    }
    process.exit(0);
  });

  ws.on('error', (err) => {
    clearKeepAlive();
    console.error(`\n❌ Error en conexión de túnel: ${err.message}`);
    process.exit(1);
  });
};

const handleIncomingHttpRequest = (ws, reqMsg, localPort) => {
  const startTime = Date.now();
  const { id, method, url: reqUrl, headers, body } = reqMsg;

  // Filtrar o reescribir cabeceras para localhost
  const localHeaders = { ...headers };
  localHeaders.host = `localhost:${localPort}`;

  const requestOptions = {
    hostname: '127.0.0.1',
    port: localPort,
    path: reqUrl,
    method,
    headers: localHeaders,
  };

  const localReq = http.request(requestOptions, (localRes) => {
    const resChunks = [];

    localRes.on('data', (chunk) => resChunks.push(chunk));

    localRes.on('end', () => {
      const latencyMs = Date.now() - startTime;
      const resBodyBuffer = Buffer.concat(resChunks);

      // Responder a través del WebSocket hacia el proxy
      const responsePayload = {
        type: MESSAGE_TYPES.HTTP_RESPONSE,
        id,
        statusCode: localRes.statusCode,
        headers: localRes.headers,
        body: resBodyBuffer.toString('base64'),
      };

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(responsePayload));
      }

      // Registrar en el dashboard de la consola
      ui.addRequestLog(method, reqUrl, localRes.statusCode, latencyMs);
    });
  });

  localReq.on('error', (err) => {
    const latencyMs = Date.now() - startTime;
    console.error(`[Error conectando a localhost:${localPort}]: ${err.message}`);

    const errorPayload = {
      type: MESSAGE_TYPES.HTTP_RESPONSE,
      id,
      statusCode: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: Buffer.from(`Error 502 Bad Gateway: No se pudo conectar a http://localhost:${localPort}\n${err.message}`).toString(
        'base64'
      ),
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(errorPayload));
    }

    ui.addRequestLog(method, reqUrl, 502, latencyMs);
  });

  // Si hay cuerpo en la petición (POST/PUT/PATCH), escribirlo
  if (body) {
    localReq.write(Buffer.from(body, 'base64'));
  }

  localReq.end();
};

module.exports = {
  startTunnel,
};
