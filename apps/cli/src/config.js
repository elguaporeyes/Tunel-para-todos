const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_FILE = path.join(os.homedir(), '.mitunelrc');

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
    serverUrl: process.env.MITUNEL_SERVER || 'ws://localhost:8080',
    pricingUrl: 'https://mitunel.dev/pricing',
  };
};

const saveConfig = (newConfig) => {
  const current = loadConfig();
  const merged = { ...current, ...newConfig };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
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
  CONFIG_FILE,
  loadConfig,
  saveConfig,
  setAuthToken,
  getAuthToken,
};
