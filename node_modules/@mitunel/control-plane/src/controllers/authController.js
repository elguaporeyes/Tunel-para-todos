const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiKey = require('../models/ApiKey');

const generateJwt = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'secret_fallback', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Por favor proporcione nombre, email y contraseña' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Ya existe una cuenta con este correo electrónico' });
    }

    const user = await User.create({
      name,
      email,
      password,
    });

    // Crear automáticamente su primer API Token (tk_live_...)
    const apiKey = await ApiKey.create({
      key: ApiKey.generateNewToken(),
      user: user._id,
      name: 'Default CLI Token',
    });

    const token = generateJwt(user._id);

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token,
      apiKey: apiKey.key,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isPremium: user.isPremium,
        weeklyCredits: user.weeklyCredits,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Por favor ingrese email y contraseña' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    // Obtener la API key activa del usuario
    let apiKey = await ApiKey.findOne({ user: user._id, isActive: true }).sort({ createdAt: -1 });
    if (!apiKey) {
      apiKey = await ApiKey.create({
        key: ApiKey.generateNewToken(),
        user: user._id,
        name: 'Default CLI Token',
      });
    }

    const token = generateJwt(user._id);

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      apiKey: apiKey.key,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isPremium: user.isPremium,
        weeklyCredits: user.weeklyCredits,
        customSubdomain: user.customSubdomain,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const apiKeys = await ApiKey.find({ user: user._id, isActive: true }).select('key name createdAt lastUsedAt');

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isPremium: user.isPremium,
        weeklyCredits: user.weeklyCredits,
        maxWeeklyCredits: user.maxWeeklyCredits,
        lastCreditsReset: user.lastCreditsReset,
        customSubdomain: user.customSubdomain,
        subscriptionStatus: user.subscriptionStatus,
      },
      apiKeys,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
