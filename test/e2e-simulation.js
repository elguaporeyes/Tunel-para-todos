const http = require('http');
const WebSocket = require('ws');
const { MESSAGE_TYPES, ERROR_CODES } = require('../packages/common/src');
const tunnelManager = require('../apps/tunnel-proxy/src/tunnelManager');
const { createHttpProxyHandler } = require('../apps/tunnel-proxy/src/httpProxy');

async function runE2EDemo() {
  console.log('--- Iniciando Simulación End-to-End de MiTunel ---');

  // 1. Iniciar servicio local dummy (ej: app de desarrollo en puerto 3123)
  const localTargetServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: '¡Hola desde localhost:3123!', path: req.url }));
  });

  await new Promise((resolve) => localTargetServer.listen(3123, resolve));
  console.log('1. Servicio localhost de prueba escuchando en http://localhost:3123');

  // 2. Iniciar Edge Proxy Server en puerto 8888
  const baseDomain = 'mitunel.test';
  const proxyHandler = createHttpProxyHandler(baseDomain, 'https://mitunel.test/pricing');
  const edgeProxyServer = http.createServer(proxyHandler);

  // Servidor WebSocket integrado
  const wss = new WebSocket.Server({ server: edgeProxyServer });
  wss.on('connection', (ws, req) => {
    // Simular registro de túnel validado con subdominio 'demo-app'
    tunnelManager.registerTunnel('demo-app', {
      ws,
      userId: 'user_123',
      apiKeyId: 'key_123',
      isPremium: false,
      weeklyCredits: 10,
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === MESSAGE_TYPES.HTTP_RESPONSE) {
          tunnelManager.resolvePendingRequest(msg.id, msg);
        }
      } catch (err) {}
    });
  });

  await new Promise((resolve) => edgeProxyServer.listen(8888, resolve));
  console.log('2. Edge Proxy Server escuchando en http://localhost:8888 (*.mitunel.test)');

  // 3. Conectar cliente WebSocket (simulando CLI mitunel)
  const clientWs = new WebSocket('ws://localhost:8888');

  clientWs.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === MESSAGE_TYPES.HTTP_REQUEST) {
      // Reenviar a localhost:3123
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: 3123,
          path: msg.url,
          method: msg.method,
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('base64');
            clientWs.send(
              JSON.stringify({
                type: MESSAGE_TYPES.HTTP_RESPONSE,
                id: msg.id,
                statusCode: res.statusCode,
                headers: res.headers,
                body,
              })
            );
          });
        }
      );
      req.end();
    }
  });

  await new Promise((resolve) => clientWs.on('open', resolve));
  console.log('3. CLI Client conectado exitosamente al WebSocket del Proxy.');

  // 4. Hacer una petición pública al subdominio 'demo-app.mitunel.test'
  console.log('4. Enviando solicitud HTTP pública hacia: http://localhost:8888 con Host: demo-app.mitunel.test');
  const testReq = http.request(
    {
      hostname: 'localhost',
      port: 8888,
      path: '/api/saludo',
      method: 'GET',
      headers: {
        Host: 'demo-app.mitunel.test:8888',
      },
    },
    (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        console.log(`\n Respuesta recibida a través del túnel:`);
        console.log(`- Código HTTP: ${res.statusCode}`);
        console.log(`- Contenido: ${body}`);

        // Limpieza de sockets y servidores
        clientWs.close();
        edgeProxyServer.close();
        localTargetServer.close();
        console.log('\n--- Simulación E2E completada con éxito rotundo. ---');
        process.exit(0);
      });
    }
  );

  testReq.on('error', (err) => {
    console.error('Error en prueba HTTP:', err);
    process.exit(1);
  });

  testReq.end();
}

runE2EDemo().catch((err) => {
  console.error('Error general:', err);
  process.exit(1);
});
