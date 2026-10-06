import test from 'node:test';
import assert from 'node:assert/strict';
import { serverFailure } from '../lib/server-diagnostics';

test('identifies Firebase credential and Firestore failures without logging upstream content', () => {
  assert.deepEqual(serverFailure({ code: 'app/invalid-credential', message: 'Failed to parse private key: Invalid PEM formatted message.' }), { code: 'app/invalid-credential', reason: 'firebase_private_key_invalid' });
  assert.equal(serverFailure({ code: 7, message: 'Permission denied for private-account@example.com' }).reason, 'firestore_permission_denied');
  assert.equal(serverFailure({ code: 9, message: 'Query requires an index' }).reason, 'firestore_index_required');
  assert.deepEqual(serverFailure({ code: 'secret-value', message: 'secret-value', stack: 'secret-value' }), { code: 'unknown', reason: 'unclassified' });
  assert.deepEqual(serverFailure(null), { code: 'unknown', reason: 'unclassified' });
});
