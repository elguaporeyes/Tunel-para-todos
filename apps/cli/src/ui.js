// Estilos ANSI para la consola sin dependencias pesadas
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

class TunnelUI {
  constructor() {
    this.requests = [];
    this.maxLogs = 10;
    this.sessionInfo = null;
  }

  setSession(info) {
    this.sessionInfo = info;
    this.render();
  }

  updateCredits(remainingCredits) {
    if (this.sessionInfo) {
      this.sessionInfo.weeklyCredits = remainingCredits;
      this.render();
    }
  }

  addRequestLog(method, path, status, latencyMs) {
    this.requests.unshift({
      time: new Date().toLocaleTimeString(),
      method: method.toUpperCase(),
      path,
      status,
      latency: `${latencyMs}ms`,
    });

    if (this.requests.length > this.maxLogs) {
      this.requests.pop();
    }

    this.render();
  }

  render() {
    if (!this.sessionInfo) return;

    // Limpiar pantalla y posicionar cursor arriba
    process.stdout.write('\x1b[2J\x1b[0;0H');

    const { publicUrl, localPort, isPremium, weeklyCredits, subdomain } = this.sessionInfo;

    const planBadge = isPremium
      ? `${colors.bgBlue}${colors.white} PREMIUM ${colors.reset}`
      : `${colors.bgYellow}\x1b[30m FREE TIER ${colors.reset}`;

    const creditsDisplay = isPremium
      ? `${colors.green}Ilimitados 🚀${colors.reset}`
      : `${colors.yellow}${weeklyCredits} restantes esta semana${colors.reset}`;

    console.log(`${colors.cyan}${colors.bright}========================================================================${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}  🚇  MiTunel CLI  -  Localhost Reverse Proxy Gateway  ${planBadge}${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}========================================================================${colors.reset}`);
    console.log(`  ${colors.bright}Estado:${colors.reset}           ${colors.green}● En Línea${colors.reset}`);
    console.log(`  ${colors.bright}Túnel Público:${colors.reset}    ${colors.bright}${colors.cyan}${publicUrl}${colors.reset}`);
    if (publicUrl && publicUrl.includes('/t/')) {
      const paramUrl = publicUrl.replace(/\/t\/[^/?#]+/, '') + `?tunnel=${subdomain}`;
      console.log(`  ${colors.dim}URL con parámetro:${colors.reset} ${colors.dim}${paramUrl}${colors.reset}`);
    }
    console.log(`  ${colors.bright}Servicio Local:${colors.reset}   ${colors.yellow}http://localhost:${localPort}${colors.reset}`);
    console.log(`  ${colors.bright}Subdominio:${colors.reset}       ${subdomain}`);
    console.log(`  ${colors.bright}Créditos:${colors.reset}         ${creditsDisplay}`);
    console.log(`${colors.dim}  Presiona Ctrl+C para finalizar la conexión del túnel${colors.reset}`);
    console.log(`${colors.cyan}------------------------------------------------------------------------${colors.reset}`);
    console.log(`${colors.bright}  HISTORIAL DE PETICIONES HTTP EN TIEMPO REAL:${colors.reset}`);
    console.log(`  ${'HORA'.padEnd(10)} ${'MÉTODO'.padEnd(8)} ${'ESTADO'.padEnd(8)} ${'DURACIÓN'.padEnd(10)} RUTA`);

    if (this.requests.length === 0) {
      console.log(`${colors.dim}  (Aún no se han recibido peticiones a través de la URL pública)${colors.reset}`);
    } else {
      for (const req of this.requests) {
        let statusColor = colors.green;
        if (req.status >= 500) statusColor = colors.red;
        else if (req.status >= 400) statusColor = colors.yellow;
        else if (req.status >= 300) statusColor = colors.cyan;

        console.log(
          `  ${req.time.padEnd(10)} ${colors.bright}${req.method.padEnd(8)}${colors.reset} ${statusColor}${String(req.status).padEnd(8)}${colors.reset} ${req.latency.padEnd(10)} ${req.path}`
        );
      }
    }
    console.log(`${colors.cyan}========================================================================${colors.reset}`);
  }

  showCreditsExhaustedAlert(pricingUrl) {
    console.log('\n');
    console.log(`${colors.bgRed}${colors.white}${colors.bright}                                                                        ${colors.reset}`);
    console.log(`${colors.bgRed}${colors.white}${colors.bright}  ⚠️  ALERTA DE CUPO: TUS CRÉDITOS SEMANALES SE HAN AGOTADO            ${colors.reset}`);
    console.log(`${colors.bgRed}${colors.white}${colors.bright}                                                                        ${colors.reset}`);
    console.log(`\n${colors.yellow}⚠️ Tus tokens gratuitos de la semana se han agotado.${colors.reset}`);
    console.log(`Para continuar publicando tus servicios localhost, actualiza a Premium aquí:\n`);
    console.log(`👉 ${colors.bright}${colors.cyan}${pricingUrl || 'https://mitunel.dev/pricing'}${colors.reset}\n`);
    console.log(`${colors.dim}Con Premium obtienes túneles ilimitados y reserva de subdominios fijos.${colors.reset}\n`);
  }

  showAuthError(message) {
    console.log(`\n${colors.red}${colors.bright}❌ Error de Autenticación:${colors.reset} ${message}`);
    console.log(`${colors.yellow}Ejecuta: mitunel authtoken <TU_API_KEY> para configurar tu token.${colors.reset}\n`);
  }
}

module.exports = new TunnelUI();
