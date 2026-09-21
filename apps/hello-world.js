const http = require('http');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  console.log(`[Hello App] Petición recibida: ${req.method} ${req.url}`);

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(
    JSON.stringify(
      {
        status: 'ok',
        app: 'MiTunel Hello World App',
        message: '¡Hola Mundo! Tu servidor local está expuesto y funcionando correctamente a través de Render.com',
        timestamp: new Date().toISOString(),
        request: {
          method: req.method,
          url: req.url,
          headers: req.headers,
        },
      },
      null,
      2
    )
  );
});

server.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 Servidor "Hello World" activo en: http://localhost:${PORT}`);
  console.log(`👉 Para conectar el túnel ejecuta en otra consola:`);
  console.log(`   npx mitunel authtoken <TU_API_KEY>`);
  console.log(`   npx mitunel http ${PORT}`);
  console.log('====================================================');
});
