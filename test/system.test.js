const test = require('node:test');
const assert = require('node:assert/strict');
const { getSubdomainFromHost } = require('../apps/tunnel-proxy/src/httpProxy');
const { MESSAGE_TYPES, ERROR_CODES, DEFAULT_FREE_WEEKLY_CREDITS } = require('../packages/common/src');
const ApiKey = require('../apps/control-plane/src/models/ApiKey');

test('Common Protocol Constants', () => {
  assert.equal(DEFAULT_FREE_WEEKLY_CREDITS, 100);
  assert.equal(MESSAGE_TYPES.HTTP_REQUEST, 'HTTP_REQUEST');
  assert.equal(ERROR_CODES.CREDITS_EXHAUSTED, 'CREDITS_EXHAUSTED');
});

test('Subdomain Extraction from Host Header', () => {
  const baseDomain = 'mitunel.dev';

  // Subdominio simple
  assert.equal(getSubdomainFromHost('myapp.mitunel.dev', baseDomain), 'myapp');

  // Subdominio con puerto
  assert.equal(getSubdomainFromHost('myapp.mitunel.dev:8080', baseDomain), 'myapp');

  // Dominio raíz (sin subdominio)
  assert.equal(getSubdomainFromHost('mitunel.dev', baseDomain), null);
  assert.equal(getSubdomainFromHost('mitunel.dev:8080', baseDomain), null);
  assert.equal(getSubdomainFromHost('localhost:8080', baseDomain), null);

  // Subdominio localhost
  assert.equal(getSubdomainFromHost('tunnel123.localhost', baseDomain), 'tunnel123');

  // Soporte pasando objeto Request con header host
  assert.equal(getSubdomainFromHost({ headers: { host: 'demo.mitunel.dev:443' } }, baseDomain), 'demo');

  // Soporte pasando objeto Request con X-Forwarded-Host (Render, Cloudflare, proxies inversos)
  assert.equal(
    getSubdomainFromHost({ headers: { 'x-forwarded-host': 'api-client.mitunel.dev, mitunel-proxy.onrender.com' } }, baseDomain),
    'api-client'
  );
});

test('API Key Token Generation Format', () => {
  const token = ApiKey.generateNewToken();
  assert.match(token, /^tk_live_[a-f0-9]{48}$/);
});

test('Email Service HTML Template and Welcome Email Dispatch', async () => {
  const emailService = require('../apps/control-plane/src/services/emailService');
  const token = 'tk_live_test1234567890abcdef1234567890abcdef';
  const email = 'developer@example.com';
  const name = 'Desarrollador';
  const weeklyCredits = 100;

  const html = emailService.generateWelcomeTemplate({ name, email, apiKey: token, weeklyCredits });
  
  assert.ok(html.includes('MiTunel'), 'El HTML debe contener el nombre MiTunel');
  assert.ok(html.includes(token), 'El HTML debe contener el token generado');
  assert.ok(html.includes('100'), 'El HTML debe mencionar los 100 créditos');
  assert.ok(html.includes('mitunel authtoken'), 'El HTML debe incluir la instrucción de CLI');

  const sendResult = await emailService.sendWelcomeEmail({ name, email, apiKey: token, weeklyCredits });
  assert.equal(sendResult.success, true);
});

test('Email Service HTML Escaping and Injection Prevention', () => {
  const emailService = require('../apps/control-plane/src/services/emailService');
  const maliciousName = '<script>alert("hack")</script>';
  const maliciousEmail = 'attacker"><script>@test.com';

  const html = emailService.generateWelcomeTemplate({
    name: maliciousName,
    email: maliciousEmail,
    apiKey: 'tk_live_safe123',
    weeklyCredits: 100,
  });

  assert.ok(!html.includes('<script>'), 'El HTML no debe contener tags <script> sin escapar');
  assert.ok(html.includes('&lt;script&gt;'), 'El HTML debe escapar los caracteres especiales');
});

test('Email Service Token Recovery Dispatch', async () => {
  const emailService = require('../apps/control-plane/src/services/emailService');
  const result = await emailService.sendTokenRecoveryEmail({
    email: 'existing@example.com',
    name: 'Usuario Existente',
    apiKey: 'tk_live_recovery987654321',
    weeklyCredits: 100,
  });
  assert.equal(result.success, true);
});

