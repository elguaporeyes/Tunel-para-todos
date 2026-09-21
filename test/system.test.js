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
});

test('API Key Token Generation Format', () => {
  const token = ApiKey.generateNewToken();
  assert.match(token, /^tk_live_[a-f0-9]{48}$/);
});
