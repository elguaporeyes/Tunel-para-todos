const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protectUser = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado, no se proporcionó token de sesión'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_fallback');
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'El usuario ya no existe o la sesión expiró'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Token inválido o expirado'
    });
  }
};

const verifyInternalProxy = (req, res, next) => {
  const proxySecret = req.headers['x-proxy-secret'] || req.headers['x-internal-api-key'] || req.headers['authorization'];
  const expectedSecret = process.env.INTERNAL_API_KEY || process.env.INTERNAL_PROXY_SECRET || 'proxy_internal_secret_key_change_in_prod';

  if (!proxySecret || (proxySecret !== expectedSecret && proxySecret !== `Bearer ${expectedSecret}`)) {
    return res.status(403).json({
      success: false,
      error: 'Acceso denegado: Firma de proxy interno inválida (verifica INTERNAL_API_KEY / INTERNAL_PROXY_SECRET)'
    });
  }
  next();
};

module.exports = {
  protectUser,
  verifyInternalProxy,
};
