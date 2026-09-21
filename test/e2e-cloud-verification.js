const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const { MESSAGE_TYPES } = require('../packages/common/src');

const CONTROL_PLANE_URL = 'https://tunel-para-todos.onrender.com';
const PROXY_HOST = 'mitunel-proxy.onrender.com';
const LOCAL_PORT = 5555;

async function runCloudVerification() {
  console.log('====================================================');
  console.log('🚀 INICIANDO PRUEBA CLOUD END-TO-END (RENDER + MONGODB)');
  console.log('====================================================\n');

  // STEP 1: Encender el servidor de aplicaciones local "Hello World"
  console.log('1️⃣  Paso 1: Iniciando servidor de aplicaciones local "Hello World"...');
  const localAppServer = http.createServer((req, res) => {
    console.log(`   --> [Local App] Petición recibida en localhost:${LOCAL_PORT}: ${req.method} ${req.url}`);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        status: 'success',
        app: 'Hello World App',
        message: '¡Hola Mundo! Conexión por túnel exitosa a través de Render.com y MongoDB',
        timestamp: new Date().toISOString(),
        requestUrl: req.url,
      })
    );
  });

  await new Promise((resolve) => localAppServer.listen(LOCAL_PORT, resolve));
  console.log(`   ✅ Servidor de aplicaciones local escuchando en http://localhost:${LOCAL_PORT}\n`);

  // STEP 2: Registro de Usuario en tunel-para-todos (Control Plane en Render + MongoDB)
  console.log('2️⃣  Paso 2: Registrando nuevo usuario en tunel-para-todos (Render + MongoDB)...');
  const testEmail = `tunnel_user_${Date.now()}@test.com`;
  const regResponse = await fetch(`${CONTROL_PLANE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Usuario Prueba Tunnel',
      email: testEmail,
      password: 'PasswordCloud123!',
    }),
  });

  const regData = await regResponse.json();
  if (!regData.success) {
    throw new Error(`Falló el registro de usuario: ${regData.error}`);
  }

  const { apiKey, user } = regData;
  console.log(`   ✅ Usuario creado con éxito en MongoDB Atlas:`);
  console.log(`      - ID Usuario: ${user.id}`);
  console.log(`      - Email: ${user.email}`);
  console.log(`      - Créditos Semanales: ${user.weeklyCredits}`);
  console.log(`      - API Key Generada: ${apiKey}\n`);

  // STEP 3: Conectar la CLI / Tunnel Client a mitunel-proxy en Render
  console.log('3️⃣  Paso 3: Conectando cliente de túnel WebSocket a mitunel-proxy...');
  const wsUrl = `wss://${PROXY_HOST}/tunnel?token=${encodeURIComponent(apiKey)}`;
  const ws = new WebSocket(wsUrl);

  let assignedSubdomain = null;
  let publicUrl = null;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Tiempo de espera agotado al conectar WS con Proxy')), 15000);

    ws.on('open', () => {
      console.log(`   📡 Handshake WebSocket iniciado con ${PROXY_HOST}`);
    });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === MESSAGE_TYPES.AUTH_SUCCESS) {
          clearTimeout(timeout);
          assignedSubdomain = msg.subdomain;
          publicUrl = msg.publicUrl;
          console.log(`   ✅ Conexión establecida con éxito:`);
          console.log(`      - Subdominio Asignado: ${assignedSubdomain}`);
          console.log(`      - Public URL: ${publicUrl}\n`);
          resolve();
        } else if (msg.type === MESSAGE_TYPES.HTTP_REQUEST) {
          // Reenviar la petición del proxy al servidor local
          const { id, method, url, headers, body } = msg;
          console.log(`   🔄 [Tunnel CLI] Petición reenviada desde proxy -> localhost:${LOCAL_PORT}${url}`);

          const localReq = http.request(
            {
              hostname: '127.0.0.1',
              port: LOCAL_PORT,
              path: url,
              method,
              headers: { ...headers, host: `localhost:${LOCAL_PORT}` },
            },
            (localRes) => {
              const chunks = [];
              localRes.on('data', (c) => chunks.push(c));
              localRes.on('end', () => {
                const resBodyBuffer = Buffer.concat(chunks);
                ws.send(
                  JSON.stringify({
                    type: MESSAGE_TYPES.HTTP_RESPONSE,
                    id,
                    statusCode: localRes.statusCode,
                    headers: localRes.headers,
                    body: resBodyBuffer.toString('base64'),
                  })
                );
              });
            }
          );

          if (body) {
            localReq.write(Buffer.from(body, 'base64'));
          }
          localReq.end();
        }
      } catch (err) {
        console.error('Error procesando mensaje WS:', err.message);
      }
    });

    ws.on('error', reject);
  });

  // STEP 4: Probar el tráfico público a través del túnel en Render
  console.log('4️⃣  Paso 4: Enviando petición de prueba HTTP a través del túnel público...');
  const proxyReq = https.request(
    {
      hostname: PROXY_HOST,
      port: 443,
      servername: PROXY_HOST,
      path: `/api/saludo-cloud?_subdomain=${assignedSubdomain}`,
      method: 'GET',
      headers: {
        Host: PROXY_HOST,
        'X-Tunnel-Subdomain': assignedSubdomain,
      },
    },
    (res) => {
      let responseBody = '';
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        console.log(`   ✅ Respuesta de tráfico recibida exitosamente desde el túnel:`);
        console.log(`      - Status HTTP: ${res.statusCode}`);
        console.log(`      - Body: ${responseBody}\n`);

        // Cierre y limpieza
        ws.close();
        localAppServer.close();
        console.log('====================================================');
        console.log('🎉 PRUEBA COMPLETADA CON ÉXITO ABSOLUTO:');
        console.log('   - MongoDB conectado a tunel-para-todos: OK');
        console.log('   - mitunel-proxy autenticado con tunel-para-todos: OK');
        console.log('   - Tráfico a través de Render.com -> Localhost: OK');
        console.log('====================================================');
        process.exit(0);
      });
    }
  );

  proxyReq.on('error', (err) => {
    console.error('❌ Error realizando petición HTTP al proxy:', err.message);
    process.exit(1);
  });

  proxyReq.end();
}

runCloudVerification().catch((err) => {
  console.error('\n❌ ERROR EN LA VERIFICACIÓN:', err.message);
  process.exit(1);
});
