#!/usr/bin/env node

const { Command } = require('commander');
const { setAuthToken, getAuthToken, loadConfig, CONFIG_FILE } = require('../src/config');
const { startTunnel } = require('../src/tunnelClient');

const program = new Command();

program
  .name('mitunel')
  .description('Herramienta CLI para publicar servicios locales en la web de forma segura')
  .version('1.0.0');

const https = require('https');
const http = require('http');
const crypto = require('crypto');

// Comando: mitunel register <email>
program
  .command('register <email>')
  .description('Crea una cuenta nueva y guarda el token automáticamente')
  .option('-p, --password <password>', 'Contraseña para la cuenta')
  .option('-n, --name <name>', 'Nombre de usuario')
  .option('--api <apiUrl>', 'URL del servidor de autenticación (Control Plane)', 'https://tunel-para-todos.onrender.com')
  .action(async (email, options) => {
    if (!email || !email.includes('@')) {
      console.error('\n❌ Por favor especifica un correo electrónico válido.');
      process.exit(1);
    }

    const name = options.name || email.split('@')[0];
    const password = options.password || `Mitunel_${crypto.randomBytes(4).toString('hex')}!`;
    const payload = JSON.stringify({ name, email, password });

    const apiUrl = options.api.replace(/\/+$/, '');
    const url = new URL(`${apiUrl}/api/auth/register`);
    const client = url.protocol === 'https:' ? https : http;

    console.log(`\nCreando cuenta para ${email}...`);

    const req = client.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const data = JSON.parse(rawData);
            if (res.statusCode >= 200 && res.statusCode < 300 && data.success && data.apiKey) {
              setAuthToken(data.apiKey);
              console.log(`\n🎉 ¡Cuenta registrada exitosamente!`);
              console.log(`   Email:        ${email}`);
              console.log(`   API Key:      ${data.apiKey}`);
              console.log(`   Contraseña:   ${password}`);
              console.log(`   Créditos:     ${data.user?.weeklyCredits ?? 100} créditos semanales`);
              console.log(`\n💾 Token guardado automáticamente en: ${CONFIG_FILE}`);
              console.log(`👉 Ya puedes iniciar tu túnel con: mitunel http 3000\n`);
            } else {
              console.error(`\n❌ Error al registrar cuenta: ${data.error || 'Respuesta inválida del servidor'}\n`);
              process.exit(1);
            }
          } catch (err) {
            console.error('\n❌ Error al procesar la respuesta del servidor:', err.message);
            process.exit(1);
          }
        });
      }
    );

    req.on('error', (err) => {
      console.error(`\n❌ Error de red al contactar ${apiUrl}:`, err.message);
      process.exit(1);
    });

    req.write(payload);
    req.end();
  });

// Comando: mitunel authtoken <API_KEY>
program
  .command('authtoken <token>')
  .description('Guarda tu API Token de autenticación en el archivo de configuración local (~/.mitunel/config.json)')
  .action((token) => {
    if (!token || (!token.startsWith('tk_live_') && !token.startsWith('eyJ'))) {
      console.warn('⚠️ Advertencia: Los tokens válidos son API Keys ("tk_live_...") o tokens JWT ("eyJ..."). Guardando de todas formas.');
    }
    setAuthToken(token);
    console.log(`\n✅ Authtoken guardado exitosamente en: ${CONFIG_FILE}`);
    console.log(`Ahora puedes iniciar un túnel ejecutando: mitunel http <puerto>\n`);
  });

// Comando: mitunel http <PUERTO>
program
  .command('http <port>')
  .description('Inicia un túnel seguro hacia un puerto HTTP local')
  .option('-s, --subdomain <subdomain>', 'Subdominio personalizado (requiere plan Premium)')
  .option('--server <serverUrl>', 'URL del servidor proxy WebSocket (ej: ws://localhost:8080 o wss://mitunel.dev)')
  .action((portStr, options) => {
    const port = parseInt(portStr, 10);
    if (isNaN(port) || port <= 0 || port > 65535) {
      console.error('\n❌ Por favor especifica un número de puerto válido entre 1 y 65535.');
      process.exit(1);
    }

    const token = getAuthToken();
    if (!token) {
      console.error('\n❌ No se encontró ningún API Token configurado.');
      console.error('👉 Ejecuta primero: mitunel authtoken <TU_API_KEY>');
      console.error('O define la variable de entorno MITUNEL_AUTHTOKEN.\n');
      process.exit(1);
    }

    const config = loadConfig();
    const serverUrl = options.server || config.serverUrl || 'https://mitunel-proxy.onrender.com';
    const pricingUrl = config.pricingUrl || 'https://mitunel.dev/pricing';

    console.log(`\nIniciando conexión con ${serverUrl}...`);

    startTunnel({
      serverUrl,
      token,
      localPort: port,
      requestedSubdomain: options.subdomain,
      pricingUrl,
    });
  });

// Manejo de comandos desconocidos
program.on('command:*', () => {
  console.error('\n❌ Comando no reconocido. Ejecuta "mitunel --help" para ver la lista de comandos disponibles.\n');
  process.exit(1);
});

program.parse(process.argv);

if (process.argv.length <= 2) {
  program.help();
}
