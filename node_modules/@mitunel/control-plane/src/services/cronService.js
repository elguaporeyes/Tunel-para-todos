const cron = require('node-cron');
const User = require('../models/User');
const { DEFAULT_FREE_WEEKLY_CREDITS } = require('@mitunel/common');

/**
 * Servicio de restablecimiento semanal de créditos:
 * Se ejecuta automáticamente cada Domingo a las 00:00 UTC ('0 0 * * 0').
 * Restablece los 100 créditos semanales a los usuarios del plan Free.
 */
const initWeeklyCreditResetCron = () => {
  // Cron semanal: 0 0 * * 0 (Cada domingo a las 00:00 UTC)
  const scheduleExpression = '0 0 * * 0';

  console.log(`[Cron Service] Programando reseteo semanal de créditos (${scheduleExpression}) en zona horaria UTC`);

  cron.schedule(
    scheduleExpression,
    async () => {
      console.log(`[Cron Service] [${new Date().toISOString()}] Iniciando restablecimiento de créditos semanales...`);
      try {
        const result = await User.updateMany(
          { isPremium: false },
          {
            $set: {
              weeklyCredits: DEFAULT_FREE_WEEKLY_CREDITS,
              lastCreditsReset: new Date(),
            },
          }
        );

        console.log(`[Cron Service] Éxito: Se restablecieron los ${DEFAULT_FREE_WEEKLY_CREDITS} créditos a ${result.modifiedCount} usuarios Free.`);
      } catch (error) {
        console.error(`[Cron Service Error] Fallo al restablecer créditos semanales: ${error.message}`);
      }
    },
    {
      scheduled: true,
      timezone: 'UTC',
    }
  );

  // Verificación adicional al iniciar el servicio:
  // Si algún usuario Free tiene más de 7 días sin reseteo debido a que el servidor estuvo apagado
  checkAndResetOutdatedUsers();
};

const checkAndResetOutdatedUsers = async () => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await User.updateMany(
      {
        isPremium: false,
        lastCreditsReset: { $lte: sevenDaysAgo },
      },
      {
        $set: {
          weeklyCredits: DEFAULT_FREE_WEEKLY_CREDITS,
          lastCreditsReset: new Date(),
        },
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`[Cron Service Startup] Se restablecieron créditos pendientes a ${result.modifiedCount} usuarios con ciclos vencidos.`);
    }
  } catch (error) {
    console.warn(`[Cron Service Startup Notice] No se pudo verificar usuarios pendientes en inicio: ${error.message}`);
  }
};

module.exports = {
  initWeeklyCreditResetCron,
  checkAndResetOutdatedUsers,
};
