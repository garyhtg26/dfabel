// Reproduce Vercel's CommonJS loader without Node's optional require(ESM).
// No cloud credentials, accounts or network requests are used.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { generateKeyPairSync, sign, verify } = require('node:crypto');
require('firebase-admin/auth');
require('firebase-admin/firestore');
const firebaseRequire = createRequire(require.resolve('firebase-admin/auth'));
const { JwksClient } = firebaseRequire('jwks-rsa');
(async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'runtime-check', alg: 'RS256', use: 'sig' };
  const client = new JwksClient({ jwksUri: 'https://example.invalid/jwks', fetcher: async () => ({ keys: [jwk] }) });
  const key = await client.getSigningKey(jwk.kid);
  const payload = Buffer.from('D’Fable dependency compatibility check');
  const signature = sign('RSA-SHA256', payload, privateKey);
  assert.equal(verify('RSA-SHA256', payload, key.getPublicKey(), signature), true);
  assert.equal(verify('RSA-SHA256', Buffer.from('tampered'), key.getPublicKey(), signature), false);
  await assert.rejects(client.getSigningKey('missing-key'));
  console.log('PASS: Firebase Admin loads without require(ESM); JWKS key conversion validates signatures and rejects tampering.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
