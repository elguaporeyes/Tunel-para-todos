require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { initWeeklyCreditResetCron } = require('./services/cronService');

// Inicializar conexión a la base de datos
connectDB();

// Inicializar Cron Job de recarga semanal de créditos
initWeeklyCreditResetCron();

const app = express();

// Middlewares globales
app.use(cors());

// El webhook de Stripe requiere el cuerpo sin parsear (raw) antes del parser JSON global
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'mitunel-control-plane',
    timestamp: new Date().toISOString(),
  });
});

// Rutas de la API
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/keys', require('./routes/apiKeyRoutes'));
app.use('/api/billing', require('./routes/billingRoutes'));
app.use('/api/internal/tunnels', require('./routes/internalTunnelRoutes'));

// Manejador 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Ruta no encontrada en el Control Plane' });
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Error interno del servidor',
  });
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Control Plane & Billing API escuchando en puerto ${PORT}`);
  console.log(`📡 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`====================================================`);
});

module.exports = { app, server };
