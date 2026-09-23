require('dotenv').config();
const http = require('http');
const { createHttpProxyHandler } = require('./httpProxy');
const setupWebSocketServer = require('./wsServer');

const HTTP_PORT = process.env.PORT || process.env.HTTP_PORT || 8080;
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'mitunel.dev';
const PRICING_URL = process.env.PRICING_URL || 'https://mitunel.dev/pricing';

// Crear el manejador central del proxy
const proxyHandler = createHttpProxyHandler(BASE_DOMAIN, PRICING_URL);

// Servidor HTTP Edge con extracción de túnel por ?tunnel=, /t/ o cabecera
const server = http.createServer((req, res) => {
  const host = req.headers.host || '';
  let tunnelId = null;

  try {
    const parsedUrl = new URL(req.url, `http://${host}`);

    // Extraer el ID del túnel desde Query Param (?tunnel=...) o desde la Ruta (/t/...)
    tunnelId = parsedUrl.searchParams.get('tunnel');

    if (!tunnelId) {
      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
      if (pathSegments[0] === 't' && pathSegments[1]) {
        tunnelId = pathSegments[1];
      }
    }
  } catch (e) {}

  // Si no viene en la URL, intentar por cabecera
  if (!tunnelId) {
    tunnelId = req.headers['x-tunnel-id'] || req.headers['x-tunnel-subdomain'];
  }

  // Delegar al manejador central del proxy (resuelve WebSocket, reenvía al CLI y gestiona respuestas)
  return proxyHandler(req, res);
});

// Configurar servidor WebSocket para túneles entrantes
const wsManager = setupWebSocketServer(server);

// Interceptar eventos de actualización de protocolo (HTTP -> WebSocket)
server.on('upgrade', (req, socket, head) => {
  wsManager.handleUpgrade(req, socket, head);
});

server.listen(HTTP_PORT, () => {
  console.log(`====================================================`);
  console.log(`🌐 MiTunel Edge Proxy Server activo en puerto ${HTTP_PORT}`);
  console.log(`🔗 Dominio base: *.${BASE_DOMAIN}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${HTTP_PORT}/tunnel`);
  console.log(`💳 Upgrade URL: ${PRICING_URL}`);
  console.log(`====================================================`);
});

process.on('SIGTERM', () => {
  console.log('Cerrando Edge Proxy...');
  server.close(() => {
    process.exit(0);
  });
});
