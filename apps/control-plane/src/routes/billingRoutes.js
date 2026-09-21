const express = require('express');
const router = express.Router();
const {
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
  setCustomSubdomain,
} = require('../controllers/billingController');
const { protectUser } = require('../middlewares/auth');

// Endpoint Webhook Stripe (se invoca públicamente desde Stripe)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Endpoints protegidos para el usuario
router.post('/checkout-session', protectUser, createCheckoutSession);
router.post('/portal-session', protectUser, createPortalSession);
router.post('/custom-subdomain', protectUser, setCustomSubdomain);

module.exports = router;
