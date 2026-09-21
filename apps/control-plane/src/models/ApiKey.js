const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      default: 'Default API Key',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUsedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Generador de clave segura con prefijo estándar de producción
apiKeySchema.statics.generateNewToken = function () {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  return `tk_live_${randomBytes}`;
};

module.exports = mongoose.model('ApiKey', apiKeySchema);
