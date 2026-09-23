const test = require('node:test');
const assert = require('node:assert/strict');
const { getSubdomainFromHost, stripTunnelFromUrl } = require('../apps/tunnel-proxy/src/httpProxy');
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

test('Subdomain Extraction for Render Free Tier (Path /t/ and Query ?tunnel=)', () => {
  const baseDomain = 'mitunel-proxy.onrender.com';

  // 1. Dominio raíz directo en Render sin subdominio ni ruta
  assert.equal(getSubdomainFromHost({ url: '/', headers: { host: 'mitunel-proxy.onrender.com' } }, baseDomain), null);

  // 2. Extracción vía ruta /t/:subdominio (Solución Error 1016)
  assert.equal(
    getSubdomainFromHost({ url: '/t/355fbe6c', headers: { host: 'mitunel-proxy.onrender.com' } }, baseDomain),
    '355fbe6c'
  );
  assert.equal(
    getSubdomainFromHost({ url: '/t/355fbe6c/', headers: { host: 'mitunel-proxy.onrender.com' } }, baseDomain),
    '355fbe6c'
  );
  assert.equal(
    getSubdomainFromHost({ url: '/t/355fbe6c/dashboard', headers: { host: 'mitunel-proxy.onrender.com' } }, baseDomain),
    '355fbe6c'
  );
  assert.equal(
    getSubdomainFromHost({ url: '/t/355fbe6c/api/users?page=1', headers: { host: 'mitunel-proxy.onrender.com' } }, baseDomain),
    '355fbe6c'
  );

  // 3. Extracción vía Query Param ?tunnel=:subdominio
  assert.equal(
    getSubdomainFromHost({ url: '/?tunnel=355fbe6c', headers: { host: 'mitunel-proxy.onrender.com' } }, baseDomain),
    '355fbe6c'
  );
  assert.equal(
    getSubdomainFromHost({ url: '/api/data?tunnel=355fbe6c&limit=5', headers: { host: 'mitunel-proxy.onrender.com' } }, baseDomain),
    '355fbe6c'
  );

  // 4. Fallback por Referer para recursos internos (/style.css, /bundle.js)
  assert.equal(
    getSubdomainFromHost(
      {
        url: '/style.css',
        headers: {
          host: 'mitunel-proxy.onrender.com',
          referer: 'https://mitunel-proxy.onrender.com/t/355fbe6c/index.html',
        },
      },
      baseDomain
    ),
    '355fbe6c'
  );

  // 5. Fallback por Cookie mitunel_tunnel
  assert.equal(
    getSubdomainFromHost(
      {
        url: '/favicon.ico',
        headers: {
          host: 'mitunel-proxy.onrender.com',
          cookie: 'session=123; mitunel_tunnel=355fbe6c; user=demo',
        },
      },
      baseDomain
    ),
    '355fbe6c'
  );
});

test('URL Path Normalization and Stripping for Local Service (stripTunnelFromUrl)', () => {
  // Rutas raíz de túnel
  assert.equal(stripTunnelFromUrl('/t/355fbe6c', '355fbe6c'), '/');
  assert.equal(stripTunnelFromUrl('/t/355fbe6c/', '355fbe6c'), '/');
  assert.equal(stripTunnelFromUrl('/t/355fbe6c?test=1', '355fbe6c'), '/?test=1');

  // Subrutas
  assert.equal(stripTunnelFromUrl('/t/355fbe6c/dashboard', '355fbe6c'), '/dashboard');
  assert.equal(stripTunnelFromUrl('/t/355fbe6c/api/users?active=true', '355fbe6c'), '/api/users?active=true');

  // Parámetro ?tunnel=
  assert.equal(stripTunnelFromUrl('/?tunnel=355fbe6c', '355fbe6c'), '/');
  assert.equal(stripTunnelFromUrl('/api/users?tunnel=355fbe6c', '355fbe6c'), '/api/users');
  assert.equal(stripTunnelFromUrl('/api/users?tunnel=355fbe6c&role=admin', '355fbe6c'), '/api/users?role=admin');

  // Ruta normal sin túnel (debe mantenerse intacta)
  assert.equal(stripTunnelFromUrl('/home/profile', '355fbe6c'), '/home/profile');
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

