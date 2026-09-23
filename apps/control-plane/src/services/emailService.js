const nodemailer = require('nodemailer');

/**
 * Escapa caracteres especiales en cadenas para prevenir inyecciones HTML en clientes de correo.
 */
function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

class EmailService {
  constructor() {
    this.transporter = null;
    this.from = process.env.EMAIL_FROM || '"MiTunel" <no-reply@mitunel.dev>';
    this.initTransporter();
  }

  initTransporter() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
      });
    } else {
      // Modo desarrollo / fallback sin SMTP configurado
      this.transporter = null;
    }
  }

  /**
   * Genera el diseño HTML limpio para el correo de bienvenida.
   * Todas las variables son sanitizadas con escapeHtml.
   */
  generateWelcomeTemplate({ name, email, apiKey, weeklyCredits = 100 }) {
    const safeName = escapeHtml(name || email.split('@')[0]);
    const safeToken = escapeHtml(apiKey);
    const safeCredits = escapeHtml(weeklyCredits);

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Bienvenido a MiTunel!</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0b0f19;
      padding: 40px 15px;
      box-sizing: border-box;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background: #131b2e;
      border: 1px solid #1e293b;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      padding: 32px 36px 24px;
      border-bottom: 1px solid #1e293b;
      text-align: center;
    }
    .logo-text {
      font-size: 26px;
      font-weight: 800;
      color: #38bdf8;
      letter-spacing: -0.5px;
      display: inline-block;
    }
    .logo-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      padding: 3px 8px;
      border-radius: 9999px;
      margin-left: 8px;
      vertical-align: middle;
      border: 1px solid rgba(56, 189, 248, 0.3);
    }
    .content {
      padding: 32px 36px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #f8fafc;
      margin-top: 0;
      margin-bottom: 12px;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #94a3b8;
      margin: 0 0 16px;
    }
    .credits-card {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.25);
      border-radius: 8px;
      padding: 16px 20px;
      margin: 24px 0;
      display: flex;
      align-items: center;
    }
    .credits-value {
      font-size: 24px;
      font-weight: 800;
      color: #34d399;
      margin-right: 12px;
    }
    .credits-text {
      font-size: 14px;
      color: #a7f3d0;
      margin: 0;
      line-height: 1.4;
    }
    .token-section {
      margin: 28px 0;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 18px 20px;
    }
    .token-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 8px;
    }
    .token-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 14px;
      color: #38bdf8;
      background: #090d16;
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 12px 14px;
      word-break: break-all;
      user-select: all;
      display: block;
      margin: 0;
    }
    .steps-section {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #1e293b;
    }
    .steps-title {
      font-size: 14px;
      font-weight: 600;
      color: #cbd5e1;
      margin-bottom: 12px;
    }
    .cmd-box {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      background: #090d16;
      border: 1px solid #1e293b;
      color: #e2e8f0;
      padding: 8px 12px;
      border-radius: 6px;
      margin-bottom: 8px;
      display: block;
    }
    .cmd-comment {
      color: #64748b;
      font-size: 12px;
      margin-bottom: 4px;
    }
    .footer {
      background: #0f172a;
      padding: 20px 36px;
      text-align: center;
      border-top: 1px solid #1e293b;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <span class="logo-text">⚡ MiTunel</span>
        <span class="logo-badge">Bienvenido</span>
      </div>

      <div class="content">
        <h1>¡Hola, ${safeName}! 👋</h1>
        <p>
          Gracias por unirte a <strong>MiTunel</strong>. Ya puedes comenzar a exponer tus aplicaciones locales, APIs y servidores de desarrollo a Internet de manera instantánea y segura.
        </p>

        <div class="credits-card">
          <div class="credits-value">🎁 ${safeCredits}</div>
          <div class="credits-text">
            <strong>Créditos semanales gratuitos asignados.</strong><br>
            Se renuevan automáticamente cada semana para mantener tus túneles siempre activos.
          </div>
        </div>

        <div class="token-section">
          <div class="token-label">Tu Token de Autenticación (API Key)</div>
          <code class="token-code">${safeToken}</code>
          <p style="font-size: 12px; color: #64748b; margin-top: 8px; margin-bottom: 0;">
            Mantén este token en secreto. Es tu llave personal para conectar clientes CLI a tu cuenta.
          </p>
        </div>

        <div class="steps-section">
          <div class="steps-title">Primeros pasos con la CLI:</div>
          
          <div class="cmd-comment"># 1. Configura tu token en la terminal:</div>
          <div class="cmd-box">mitunel authtoken ${safeToken}</div>

          <div class="cmd-comment"># 2. Inicia un túnel hacia tu servidor local:</div>
          <div class="cmd-box">mitunel http 3000</div>
        </div>
      </div>

      <div class="footer">
        <p style="margin: 0 0 6px;">Este correo fue enviado automáticamente por el sistema de MiTunel.</p>
        <p style="margin: 0;">¿Necesitas ayuda? Visita nuestro repositorio o consulta la documentación de la CLI.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Genera plantilla HTML limpia para el reenvío o recuperación de token.
   */
  generateRecoveryTemplate({ name, email, apiKey, weeklyCredits = 100 }) {
    const safeName = escapeHtml(name || email.split('@')[0]);
    const safeToken = escapeHtml(apiKey);
    const safeCredits = escapeHtml(weeklyCredits);

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu Token de Autenticación - MiTunel</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #e2e8f0;
    }
    .wrapper { width: 100%; background-color: #0b0f19; padding: 40px 15px; box-sizing: border-box; }
    .container { max-width: 580px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 30px; text-align: center; border-bottom: 1px solid #1e293b; }
    .logo-text { font-size: 24px; font-weight: 800; color: #38bdf8; }
    .content { padding: 30px; }
    h1 { font-size: 20px; color: #f8fafc; margin-top: 0; }
    p { font-size: 15px; line-height: 1.6; color: #94a3b8; }
    .token-box { background: #090d16; border: 1px solid #38bdf8; border-radius: 6px; padding: 14px; font-family: monospace; color: #38bdf8; font-size: 14px; word-break: break-all; margin: 20px 0; }
    .footer { background: #0f172a; padding: 18px 30px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <span class="logo-text">⚡ MiTunel</span>
      </div>
      <div class="content">
        <h1>¡Hola de nuevo, ${safeName}! 👋</h1>
        <p>Hemos recibido una solicitud con tu correo electrónico. Aquí tienes tu Token de Autenticación activo para conectar tu CLI:</p>
        <div class="token-box">${safeToken}</div>
        <p>Tienes disponibles <strong>${safeCredits} créditos semanales</strong> en tu cuenta.</p>
        <p>Para configurarlo en tu terminal:</p>
        <pre style="background:#090d16; padding:10px; border-radius:6px; color:#e2e8f0; font-size:13px;">mitunel authtoken ${safeToken}</pre>
      </div>
      <div class="footer">
        <p style="margin: 0;">Si no solicitaste este correo, puedes ignorarlo de manera segura.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Envía el correo electrónico de bienvenida (Multi-part MIME: HTML + Texto Plano).
   */
  async sendWelcomeEmail({ email, name, apiKey, weeklyCredits = 100 }) {
    if (!email) {
      throw new Error('El correo electrónico de destino es obligatorio');
    }

    const htmlContent = this.generateWelcomeTemplate({ name, email, apiKey, weeklyCredits });
    const textContent = `
¡Bienvenido a MiTunel!

Hola ${name || email.split('@')[0]},

Te damos la bienvenida a MiTunel. Se te han asignado ${weeklyCredits} créditos semanales gratuitos.

Tu Token de Autenticación:
${apiKey}

Para comenzar a usar tu cuenta en la terminal:
1. Guarda tu token: mitunel authtoken ${apiKey}
2. Abre un túnel:   mitunel http 3000

¡Que disfrutes publicando tus proyectos con MiTunel!
    `.trim();

    const mailOptions = {
      from: this.from,
      to: email,
      subject: '⚡ ¡Bienvenido a MiTunel! Tu Token de Autenticación y 100 créditos gratuitos',
      text: textContent,
      html: htmlContent,
      headers: {
        'X-Entity-Ref-ID': apiKey,
        'X-Mailer': 'MiTunel Mailer v1.0',
      },
    };

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`[EmailService] Correo de bienvenida enviado a ${email} (MessageId: ${info.messageId})`);
        return { success: true, messageId: info.messageId };
      } catch (err) {
        console.error(`[EmailService Error] No se pudo enviar el correo a ${email}:`, err.message);
        return { success: false, error: err.message };
      }
    } else {
      console.log(`\n=============================================================`);
      console.log(`[EmailService] (Modo desarrollo / Sin SMTP configurado)`);
      console.log(`📧 Destinatario: ${email}`);
      console.log(`🎁 Créditos: ${weeklyCredits} créditos semanales`);
      console.log(`🔑 Token: ${apiKey}`);
      console.log(`=============================================================\n`);
      return { success: true, mocked: true };
    }
  }

  /**
   * Reenvía el token de autenticación a un usuario registrado previamente.
   */
  async sendTokenRecoveryEmail({ email, name, apiKey, weeklyCredits = 100 }) {
    if (!email) {
      throw new Error('El correo electrónico de destino es obligatorio');
    }

    const htmlContent = this.generateRecoveryTemplate({ name, email, apiKey, weeklyCredits });
    const textContent = `
Tu Token de Autenticación - MiTunel

Hola ${name || email.split('@')[0]},

Aquí tienes tu Token de Autenticación activo para MiTunel:
${apiKey}

Créditos semanales disponibles: ${weeklyCredits}

Para configurarlo en tu terminal:
mitunel authtoken ${apiKey}
    `.trim();

    const mailOptions = {
      from: this.from,
      to: email,
      subject: '🔑 Tu Token de Autenticación - MiTunel',
      text: textContent,
      html: htmlContent,
      headers: {
        'X-Entity-Ref-ID': apiKey,
        'X-Mailer': 'MiTunel Mailer v1.0',
      },
    };

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`[EmailService] Correo de recuperación enviado a ${email} (MessageId: ${info.messageId})`);
        return { success: true, messageId: info.messageId };
      } catch (err) {
        console.error(`[EmailService Error] No se pudo enviar el correo a ${email}:`, err.message);
        return { success: false, error: err.message };
      }
    } else {
      console.log(`\n=============================================================`);
      console.log(`[EmailService Recovery] (Modo desarrollo / Sin SMTP configurado)`);
      console.log(`📧 Destinatario: ${email}`);
      console.log(`🔑 Token reenviado: ${apiKey}`);
      console.log(`=============================================================\n`);
      return { success: true, mocked: true };
    }
  }
}

module.exports = new EmailService();
