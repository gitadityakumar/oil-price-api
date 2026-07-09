import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveLocationSelector,
  validatePin,
  validateFuels,
  validateIncludes,
  validateIsoDate,
  validateDateRange,
  resolvePagination,
  FUEL_CODES,
} from '../../src/core/validation/query';
import { AppError } from '../../src/core/errors/app-error';

function qp(s: string): URLSearchParams { return new URLSearchParams(s); }

test('validatePin: accepts 6 digits', () => {
  assert.equal(validatePin('110001'), '110001');
});

test('validatePin: rejects non-6-digit', () => {
  assert.throws(() => validatePin('11001'), (e: AppError) => e.code === 'VALIDATION_ERROR');
  assert.throws(() => validatePin('110001a'), (e: AppError) => e.code === 'VALIDATION_ERROR');
});

test('resolveLocationSelector: pin only', () => {
  const s = resolveLocationSelector(qp('pin=110001'));
  assert.equal(s.type, 'pin');
  assert.equal(s.pin, '110001');
});

test('resolveLocationSelector: city+state', () => {
  const s = resolveLocationSelector(qp('city=Delhi&state=Delhi'));
  assert.equal(s.type, 'city_state');
});

test('resolveLocationSelector: state only', () => {
  const s = resolveLocationSelector(qp('state=Delhi'));
  assert.equal(s.type, 'state');
});

test('resolveLocationSelector: outlet_id', () => {
  const s = resolveLocationSelector(qp('outlet_id=outlet_x'));
  assert.equal(s.type, 'outlet_id');
  assert.equal(s.outlet_id, 'outlet_x');
});

test('resolveLocationSelector: none -> VALIDATION_ERROR', () => {
  assert.throws(() => resolveLocationSelector(qp('')), (e: AppError) => e.code === 'VALIDATION_ERROR');
});

test('resolveLocationSelector: city without state -> error', () => {
  assert.throws(() => resolveLocationSelector(qp('city=Delhi')), (e: AppError) => e.code === 'VALIDATION_ERROR');
});

test('resolveLocationSelector: multiple selectors -> error', () => {
  assert.throws(() => resolveLocationSelector(qp('pin=110001&outlet_id=x')), (e: AppError) => e.code === 'VALIDATION_ERROR');
});

test('validateFuels: empty returns all codes', () => {
  assert.deepEqual(validateFuels(undefined), [...FUEL_CODES]);
});

test('validateFuels: normalizes to uppercase and validates', () => {
  assert.deepEqual(validateFuels(['petrol', 'diesel']), ['PETROL', 'DIESEL']);
});

test('validateFuels: rejects invalid', () => {
  assert.throws(() => validateFuels(['petrol', 'kerosene']), (e: AppError) => e.code === 'VALIDATION_ERROR');
});

test('validateIncludes: documented values pass', () => {
  assert.deepEqual(validateIncludes(['components', 'source']), ['components', 'source']);
});

test('validateIncludes: rejects undocumented', () => {
  assert.throws(() => validateIncludes(['components', 'secret']), (e: AppError) => e.code === 'VALIDATION_ERROR');
});

test('validateIsoDate: valid passes', () => {
  assert.equal(validateIsoDate('2026-07-09', 'date'), '2026-07-09');
});

test('validateIsoDate: invalid date rejected', () => {
  assert.throws(() => validateIsoDate('2026-13-09', 'date'), (e: AppError) => e.code === 'VALIDATION_ERROR');
  assert.throws(() => validateIsoDate('2026/07/09', 'date'), (e: AppError) => e.code === 'VALIDATION_ERROR');
});

test('validateIsoDate: required enforced', () => {
  assert.throws(() => validateIsoDate('', 'from', true), (e: AppError) => e.code === 'VALIDATION_ERROR');
});

test('validateDateRange: valid order passes', () => {
  const r = validateDateRange('2026-01-01', '2026-01-31');
  assert.equal(r.from, '2026-01-01');
  assert.equal(r.to, '2026-01-31');
});

test('validateDateRange: reversed rejected', () => {
  assert.throws(() => validateDateRange('2026-02-01', '2026-01-01'), (e: AppError) => e.code === 'VALIDATION_ERROR');
});

test('validateDateRange: exceeds max span rejected', () => {
  assert.throws(() => validateDateRange('2025-01-01', '2026-12-31'), (e: AppError) => e.code === 'VALIDATION_ERROR');
});

test('resolvePagination: defaults', () => {
  assert.deepEqual(resolvePagination(qp('')), { limit: 50, offset: 0 });
});

test('resolvePagination: clamps limit to 100', () => {
  assert.equal(resolvePagination(qp('limit=999')).limit, 100);
});

test('resolvePagination: clamps limit min 1', () => {
  assert.equal(resolvePagination(qp('limit=0')).limit, 1);
});