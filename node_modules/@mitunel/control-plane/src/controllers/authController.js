const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const emailService = require('../services/emailService');

const generateJwt = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'secret_fallback', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Por favor proporcione un correo electrónico' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: trimmedEmail });
    if (existingUser) {
      // Manejo de cuentas existentes (409 Conflict): Obtener su API key activa y reenviar el token por correo
      let existingApiKey = await ApiKey.findOne({ user: existingUser._id, isActive: true }).sort({ createdAt: -1 });
      if (!existingApiKey) {
        existingApiKey = await ApiKey.create({
          key: ApiKey.generateNewToken(),
          user: existingUser._id,
          name: 'Default CLI Token',
        });
      }

      // Desacoplamiento no bloqueante: Reenviar token en segundo plano
      setImmediate(async () => {
        try {
          await emailService.sendTokenRecoveryEmail({
            email: existingUser.email,
            name: existingUser.name,
            apiKey: existingApiKey.key,
            weeklyCredits: existingUser.weeklyCredits,
          });
        } catch (mailErr) {
          console.error(`[authController] Error asíncrono al reenviar token a ${existingUser.email}:`, mailErr.message);
        }
      });

      return res.status(409).json({
        success: false,
        code: 'USER_ALREADY_EXISTS',
        error: 'Ya existe una cuenta registrada con este correo electrónico.',
        message: 'Hemos reenviado tu Token de Autenticación a tu correo registrado.',
        tokenResent: true,
      });
    }

    // Si name o password no vienen proporcionados (ej. registro rápido vía CLI), asignar por defecto
    const userName = (name && name.trim()) ? name.trim() : trimmedEmail.split('@')[0];
    const userPassword = password || `Mitunel_${crypto.randomBytes(6).toString('hex')}!`;

    const user = await User.create({
      name: userName,
      email: trimmedEmail,
      password: userPassword,
    });

    // Crear automáticamente su primer API Token (tk_live_...)
    const apiKey = await ApiKey.create({
      key: ApiKey.generateNewToken(),
      user: user._id,
      name: 'Default CLI Token',
    });

    const jwtToken = generateJwt(user._id);

    // Desacoplamiento No Bloqueante: El correo se dispara en segundo plano de forma asíncrona
    setImmediate(async () => {
      try {
        await emailService.sendWelcomeEmail({
          email: user.email,
          name: user.name,
          apiKey: apiKey.key,
          weeklyCredits: user.weeklyCredits,
        });
      } catch (mailErr) {
        console.error(`[authController] Error asíncrono al enviar correo de bienvenida a ${user.email}:`, mailErr.message);
      }
    });

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token: apiKey.key,
      apiKey: apiKey.key,
      jwt: jwtToken,
      emailDispatched: true,
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
