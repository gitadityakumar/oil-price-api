import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCurrentPricesQuery } from '../src/modules/prices/price.validation';
import { validatePin } from '../src/core/validation/query';

test('task10 validation: pin and location selector rules', () => {
  assert.equal(validatePin('110001'), '110001');
  assert.throws(() => validatePin('abc'), { code: 'VALIDATION_ERROR' });
  assert.throws(() => parseCurrentPricesQuery(new URLSearchParams()), { code: 'VALIDATION_ERROR' });
  assert.throws(() => parseCurrentPricesQuery(new URLSearchParams('pin=110001&state=Delhi')), { code: 'VALIDATION_ERROR' });
});
