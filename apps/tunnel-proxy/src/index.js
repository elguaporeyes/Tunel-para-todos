require('dotenv').config();
const http = require('http');
const { createHttpProxyHandler } = require('./httpProxy');
const setupWebSocketServer = require('./wsServer');

const HTTP_PORT = process.env.PORT || process.env.HTTP_PORT || 8080;
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'mitunel.dev';
const PRICING_URL = process.env.PRICING_URL || 'https://mitunel.dev/pricing';

// Crear el servidor HTTP Edge
const proxyHandler = createHttpProxyHandler(BASE_DOMAIN, PRICING_URL);
const server = http.createServer(proxyHandler);

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
