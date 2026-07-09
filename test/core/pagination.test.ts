import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampPagination, buildPagination, DEFAULT_LIMIT, MAX_LIMIT, MAX_INTERNAL_LIMIT } from '../../src/core/http/pagination';

test('clampPagination: defaults when missing', () => {
  const r = clampPagination(undefined, undefined);
  assert.equal(r.limit, DEFAULT_LIMIT);
  assert.equal(r.offset, 0);
});

test('clampPagination: clamps limit to [1, max]', () => {
  assert.equal(clampPagination(0, 0).limit, 1);
  assert.equal(clampPagination(1000, 0).limit, MAX_LIMIT);
  assert.equal(clampPagination(50, 0).limit, 50);
});

test('clampPagination: internal max 1000', () => {
  assert.equal(clampPagination(5000, 0, MAX_INTERNAL_LIMIT).limit, MAX_INTERNAL_LIMIT);
});

test('clampPagination: rejects negative offset', () => {
  assert.equal(clampPagination(10, -5).offset, 0);
});

test('clampPagination: accepts array/string values', () => {
  assert.equal(clampPagination(['25'], ['10']).limit, 25);
  assert.equal(clampPagination('25', '10').limit, 25);
  assert.equal(clampPagination('25', '10').offset, 10);
});

test('clampPagination: invalid falls back', () => {
  assert.equal(clampPagination('abc', 'xyz').limit, DEFAULT_LIMIT);
  assert.equal(clampPagination('abc', 'xyz').offset, 0);
});

test('buildPagination: next_offset when more remain', () => {
  const p = buildPagination({ limit: 50, offset: 0, total: 534 });
  assert.equal(p.next_offset, 50);
});

test('buildPagination: next_offset null at end', () => {
  const p = buildPagination({ limit: 50, offset: 500, total: 534 });
  assert.equal(p.next_offset, null);
});

test('buildPagination: exact end boundary -> next_offset null', () => {
  // offset 484 + limit 50 = 534 == total; no more rows, so next_offset is null.
  const p = buildPagination({ limit: 50, offset: 484, total: 534 });
  assert.equal(p.next_offset, null);
});