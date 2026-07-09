import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compilePattern, matchPattern } from '../../src/core/router/path-pattern';

test('compilePattern: static segments', () => {
  const c = compilePattern('/v1/health');
  assert.deepEqual(c.segments, ['v1', 'health']);
  assert.deepEqual(c.paramNames, []);
});

test('compilePattern: param capture', () => {
  const c = compilePattern('/v1/prices/:id/components');
  assert.deepEqual(c.segments, ['v1', 'prices', ':id', 'components']);
  assert.deepEqual(c.paramNames, ['id']);
});

test('matchPattern: exact static match', () => {
  const c = compilePattern('/v1/health');
  const r = matchPattern(c, '/v1/health');
  assert.equal(r.matched, true);
  assert.deepEqual(r.params, {});
});

test('matchPattern: param capture decodes', () => {
  const c = compilePattern('/v1/sources/:id');
  const r = matchPattern(c, '/v1/sources/42');
  assert.equal(r.matched, true);
  assert.equal(r.params.id, '42');
});

test('matchPattern: trailing slash ignored', () => {
  const c = compilePattern('/v1/health');
  assert.equal(matchPattern(c, '/v1/health/').matched, true);
});

test('matchPattern: root', () => {
  const c = compilePattern('/');
  assert.equal(matchPattern(c, '/').matched, true);
});

test('matchPattern: mismatch on different length', () => {
  const c = compilePattern('/v1/sources/:id');
  assert.equal(matchPattern(c, '/v1/sources').matched, false);
  assert.equal(matchPattern(c, '/v1/sources/42/extra').matched, false);
});

test('matchPattern: static segment mismatch', () => {
  const c = compilePattern('/v1/prices');
  assert.equal(matchPattern(c, '/v1/sources').matched, false);
});