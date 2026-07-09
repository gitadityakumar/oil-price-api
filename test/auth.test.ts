import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateApiKey } from '../src/modules/auth/api-key-generator';
import { safeHashEquals } from '../src/modules/auth/auth.service';

test('task10 auth: generated key hash verifies without plaintext storage', () => {
  const generated = generateApiKey({ clientId: 'cli_task10', pepper: 'pepper' });
  assert.match(generated.api_key, /^ifp_test_cli_task10_[a-f0-9]+$/);
  assert.equal(safeHashEquals(generated.key_hash, generated.key_hash), true);
  assert.equal(safeHashEquals(generated.key_hash, 'abcd'), false);
});
