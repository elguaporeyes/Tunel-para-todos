const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { DEFAULT_FREE_WEEKLY_CREDITS } = require('@mitunel/common');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'El correo electrónico es obligatorio'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, 'La contraseña es obligatoria'],
      minlength: 6,
      select: false,
    },
    // Estado Freemium / Premium
    isPremium: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Sistema de Créditos Semanales
    weeklyCredits: {
      type: Number,
      default: DEFAULT_FREE_WEEKLY_CREDITS,
      min: 0,
    },
    maxWeeklyCredits: {
      type: Number,
      default: DEFAULT_FREE_WEEKLY_CREDITS,
    },
    lastCreditsReset: {
      type: Date,
      default: Date.now,
    },
    // Subdominio personalizado fijo (Solo disponible para Premium)
    customSubdomain: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,
      match: [/^[a-z0-9-]+$/, 'El subdominio solo puede contener caracteres alfanuméricos y guiones'],
    },
    // Stripe Billing
    stripeCustomerId: {
      type: String,
      index: true,
      sparse: true,
    },
    stripeSubscriptionId: {
      type: String,
      sparse: true,
    },
    subscriptionStatus: {
      type: String,
      enum: ['none', 'active', 'past_due', 'canceled', 'trialing'],
      default: 'none',
    },
  },
  {
    timestamps: true,
  }
);

// Hash de contraseña antes de guardar
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Método para verificar contraseña
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Verifica si el usuario tiene autorización para abrir túneles
userSchema.methods.hasTunnelAccess = function () {
  if (this.isPremium) return true;
  return this.weeklyCredits > 0;
};

// Deduce créditos
userSchema.methods.deductCredits = async function (amount = 1) {
  if (this.isPremium) return { success: true, remaining: Infinity, isPremium: true };
  if (this.weeklyCredits < amount) {
    return { success: false, remaining: this.weeklyCredits, isPremium: false };
  }
  this.weeklyCredits = Math.max(0, this.weeklyCredits - amount);
  await this.save();
  return { success: true, remaining: this.weeklyCredits, isPremium: false };
};

module.exports = mongoose.model('User', userSchema);
