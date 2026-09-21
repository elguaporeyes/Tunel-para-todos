const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const ApiKey = require('../models/ApiKey');
const User = require('../models/User');
const TunnelUsage = require('../models/TunnelUsage');
const { ERROR_CODES } = require('@mitunel/common');

exports.validateTunnelAccess = async (req, res) => {
  try {
    const { token, requestedSubdomain } = req.body;

    if (!token) {
      return res.status(400).json({
        allowed: false,
        reason: ERROR_CODES.INVALID_TOKEN,
        message: 'No se proporcionó API Token',
      });
    }

    let user = null;
    let apiKey = null;

    if (token.startsWith('tk_live_')) {
      apiKey = await ApiKey.findOne({ key: token, isActive: true }).populate('user');
      if (apiKey && apiKey.user) {
        user = apiKey.user;
      }
    } else {
      // Validar JWT emitido por el Control Plane
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production_mitunel_2026'
        );
        user = await User.findById(decoded.id);
        if (user) {
          apiKey = await ApiKey.findOne({ user: user._id, isActive: true });
          if (!apiKey) {
            apiKey = await ApiKey.create({
              key: ApiKey.generateNewToken(),
              user: user._id,
              name: 'CLI JWT Session Token',
            });
          }
        }
      } catch (jwtErr) {
        return res.status(401).json({
          allowed: false,
          reason: ERROR_CODES.INVALID_TOKEN,
          message: `Firma JWT inválida o token expirado: ${jwtErr.message}`,
        });
      }
    }

    if (!user) {
      return res.status(401).json({
        allowed: false,
        reason: ERROR_CODES.INVALID_TOKEN,
        message: 'El token de autenticación proporcionado no es válido o el usuario no existe',
      });
    }

    // Verificar si el usuario tiene saldo o es Premium
    if (!user.hasTunnelAccess()) {
      return res.status(402).json({
        allowed: false,
        reason: ERROR_CODES.CREDITS_EXHAUSTED,
        message: '⚠️ Tus tokens gratuitos de la semana se han agotado. Para continuar publicando tus servicios localhost, actualiza a Premium aquí: https://tudominio.com/pricing',
        isPremium: false,
        weeklyCredits: 0,
      });
    }

    // Determinación de subdominio
    let assignedSubdomain = '';

    if (requestedSubdomain) {
      const cleanSub = requestedSubdomain.toLowerCase().trim();

      // Subdominios fijos reservados requieren Premium
      if (!user.isPremium) {
        return res.status(403).json({
          allowed: false,
          reason: ERROR_CODES.SUBDOMAIN_RESERVED,
          message: 'La asignación de subdominios fijos o personalizados requiere una membresía Premium.',
        });
      }

      // Verificar si pertenece al usuario o si está libre
      const owner = await User.findOne({ customSubdomain: cleanSub });
      if (owner && owner._id.toString() !== user._id.toString()) {
        return res.status(409).json({
          allowed: false,
          reason: ERROR_CODES.SUBDOMAIN_UNAVAILABLE,
          message: `El subdominio "${cleanSub}" ya está reservado por otra cuenta.`,
        });
      }

      assignedSubdomain = cleanSub;
    } else {
      // Si el usuario Premium ya configuró un subdominio fijo por defecto, lo usamos
      if (user.isPremium && user.customSubdomain) {
        assignedSubdomain = user.customSubdomain;
      } else {
        // Generar subdominio aleatorio de 8 caracteres alfanuméricos
        assignedSubdomain = crypto.randomBytes(4).toString('hex');
      }
    }

    apiKey.lastUsedAt = new Date();
    await apiKey.save();

    res.json({
      allowed: true,
      userId: user._id,
      apiKeyId: apiKey._id,
      subdomain: assignedSubdomain,
      isPremium: user.isPremium,
      weeklyCredits: user.weeklyCredits,
    });
  } catch (error) {
    res.status(500).json({
      allowed: false,
      reason: ERROR_CODES.INTERNAL_ERROR,
      message: error.message,
    });
  }
};

exports.recordUsage = async (req, res) => {
  try {
    const { userId, apiKeyId, subdomain, requestsCount = 0, bytesTransferred = 0, creditsToDeduct = 0, clientIp } = req.body;

    console.log(
      `[Control Plane Metering] Consumo recibido: userId=${userId}, subdominio=${subdomain}, deducir=${creditsToDeduct} crédito(s)`
    );

    const user = await User.findById(userId);
    if (!user) {
      console.error(`[Control Plane Error] Usuario ${userId} no encontrado para deducir saldo`);
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    let isExhausted = false;

    // Descontar créditos para usuarios del plan Free
    if (!user.isPremium && creditsToDeduct > 0) {
      const deduction = await user.deductCredits(creditsToDeduct);
      console.log(
        `[Control Plane Metering] Créditos deducidos para ${user.email}. Saldo restante en MongoDB: ${user.weeklyCredits}`
      );
      if (!deduction.success || deduction.remaining <= 0) {
        isExhausted = true;
      }
    }

    // Registrar en historial de consumo de forma segura
    try {
      const validApiKey = apiKeyId && mongoose.Types.ObjectId.isValid(apiKeyId) ? apiKeyId : null;
      await TunnelUsage.create({
        user: user._id,
        apiKey: validApiKey,
        subdomain: subdomain || 'unknown',
        clientIp: clientIp || null,
        requestsCount,
        bytesTransferred,
        creditsDeducted: creditsToDeduct,
        status: isExhausted ? 'terminated_no_credits' : 'active',
        startedAt: new Date(Date.now() - 1000),
        endedAt: new Date(),
      });
    } catch (historyErr) {
      console.warn(`[Control Plane Warning] No se pudo guardar historial TunnelUsage: ${historyErr.message}`);
    }

    res.json({
      success: true,
      remainingCredits: user.isPremium ? 'unlimited' : user.weeklyCredits,
      isPremium: user.isPremium,
      isExhausted,
    });
  } catch (error) {
    console.error(`[Control Plane Error] Error general en recordUsage: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};
