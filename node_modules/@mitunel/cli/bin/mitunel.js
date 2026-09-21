#!/usr/bin/env node

const { Command } = require('commander');
const { setAuthToken, getAuthToken, loadConfig, CONFIG_FILE } = require('../src/config');
const { startTunnel } = require('../src/tunnelClient');

const program = new Command();

program
  .name('mitunel')
  .description('Herramienta CLI para publicar servicios locales en la web de forma segura')
  .version('1.0.0');

// Comando: mitunel authtoken <API_KEY>
program
  .command('authtoken <token>')
  .description('Guarda tu API Token de autenticación en el archivo de configuración local (~/.mitunelrc)')
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
    const serverUrl = options.server || config.serverUrl || 'ws://localhost:8080';
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
