const mongoose = require('mongoose');

const tunnelUsageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    apiKey: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApiKey',
      index: true,
    },
    subdomain: {
      type: String,
      required: true,
      index: true,
    },
    clientIp: {
      type: String,
    },
    requestsCount: {
      type: Number,
      default: 0,
    },
    bytesTransferred: {
      type: Number,
      default: 0,
    },
    creditsDeducted: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'closed', 'terminated_no_credits'],
      default: 'active',
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TunnelUsage', tunnelUsageSchema);
