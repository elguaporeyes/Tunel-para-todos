const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mitunel', {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[Database] Conectado exitosamente a MongoDB: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[Database Error] Error conectando a MongoDB: ${error.message}`);
    // En entornos de desarrollo, no abortar inmediatamente si mongodb no está corriendo
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
