const fs = require('fs');
const path = require('path');
const os = require('os');

// El directorio de configuración siempre vive en el Home del usuario
// (~/.mitunel/) para que sobreviva actualizaciones o reinstalaciones del .exe.
// Puede sobreescribirse con la variable de entorno MITUNEL_CONFIG_DIR.
const CONFIG_DIR = process.env.MITUNEL_CONFIG_DIR || path.join(os.homedir(), '.mitunel');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Asegurar que el directorio exista (se crea en la primera ejecución)
try {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
} catch (err) {
  // En casos muy extremos (permisos), no abortar: operar sin persistencia
}

const loadConfig = () => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    // Si el archivo está corrupto o ilegible, inicializar nuevo
  }
  return {
    serverUrl: process.env.MITUNEL_SERVER || 'https://mitunel-proxy.onrender.com',
    pricingUrl: 'https://mitunel.dev/pricing',
  };
};

const saveConfig = (newConfig) => {
  const current = loadConfig();
  const merged = { ...current, ...newConfig };
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
  } catch (err) {
    console.error(`⚠️ No se pudo guardar la configuración local en ${CONFIG_FILE}:`, err.message);
  }
  return merged;
};

const setAuthToken = (token) => {
  return saveConfig({ authtoken: token.trim() });
};

const getAuthToken = () => {
  const config = loadConfig();
  return config.authtoken || process.env.MITUNEL_AUTHTOKEN;
};

module.exports = {
  CONFIG_DIR,
  CONFIG_FILE,
  loadConfig,
  saveConfig,
  setAuthToken,
  getAuthToken,
};
