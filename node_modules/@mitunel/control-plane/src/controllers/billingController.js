const User = require('../models/User');

// Inicializar cliente de Stripe de forma segura
let stripe;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

exports.createCheckoutSession = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ success: false, error: 'Stripe no está configurado en el servidor' });
    }

    const user = await User.findById(req.user._id);

    // Si el usuario no tiene Customer ID en Stripe, lo creamos
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user._id.toString() },
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: process.env.STRIPE_PREMIUM_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing?status=canceled`,
      metadata: {
        userId: user._id.toString(),
      },
    });

    res.json({ success: true, url: session.url });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createPortalSession = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ success: false, error: 'Stripe no está configurado en el servidor' });
    }

    const user = await User.findById(req.user._id);
    if (!user.stripeCustomerId) {
      return res.status(400).json({ success: false, error: 'No se encontró un cliente Stripe asociado' });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`,
    });

    res.json({ success: true, url: portalSession.url });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Webhook de Stripe (recibe el raw body con express.raw)
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (endpointSecret && stripe) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      // En modo test/desarrollo sin firma estricta
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }
  } catch (err) {
    console.error(`[Stripe Webhook Error]: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (userId) {
          await User.findByIdAndUpdate(userId, {
            isPremium: true,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus: 'active',
          });
          console.log(`[Stripe] Usuario ${userId} ascendido a Premium exitosamente`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;

        const isPremium = status === 'active' || status === 'trialing';
        await User.findOneAndUpdate(
          { stripeCustomerId: customerId },
          {
            isPremium,
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: status,
          }
        );
        console.log(`[Stripe] Suscripción actualizada para customer ${customerId}. Estado: ${status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        await User.findOneAndUpdate(
          { stripeCustomerId: customerId },
          {
            isPremium: false,
            subscriptionStatus: 'canceled',
          }
        );
        console.log(`[Stripe] Suscripción cancelada para customer ${customerId}. Revertido a Free.`);
        break;
      }

      default:
        // Evento no manejado
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error(`[Webhook Handler Error]: ${err.message}`);
    res.status(500).json({ error: 'Error procesando evento de webhook' });
  }
};

// Reserva de subdominio personalizado para usuarios Premium
exports.setCustomSubdomain = async (req, res) => {
  try {
    const { subdomain } = req.body;
    const user = await User.findById(req.user._id);

    if (!user.isPremium) {
      return res.status(403).json({
        success: false,
        error: 'La reserva de subdominios fijos requiere una membresía Premium activa.',
      });
    }

    if (!subdomain || !/^[a-z0-9-]+$/.test(subdomain)) {
      return res.status(400).json({
        success: false,
        error: 'El subdominio solo puede contener caracteres alfanuméricos en minúsculas y guiones.',
      });
    }

    // Verificar colisión con otros usuarios
    const existing = await User.findOne({ customSubdomain: subdomain, _id: { $ne: user._id } });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Este subdominio ya está reservado por otro usuario.',
      });
    }

    user.customSubdomain = subdomain;
    await user.save();

    res.json({
      success: true,
      message: `Subdominio "${subdomain}" reservado con éxito para tu cuenta Premium.`,
      subdomain: user.customSubdomain,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
