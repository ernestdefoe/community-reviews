import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starFill } from '../src/forum/ui/starFill.ts';

test('2.5 draws two full stars, a half star and two empty ones', () => {
  assert.deepEqual(starFill(2.5), ['full', 'full', 'half', 'empty', 'empty']);
});

test('4.5 draws a half fifth star, not five full stars', () => {
  assert.deepEqual(starFill(4.5), ['full', 'full', 'full', 'full', 'half']);
});

test('rounds to the nearest half and clamps', () => {
  assert.deepEqual(starFill(4.2), ['full', 'full', 'full', 'full', 'empty']);
  assert.deepEqual(starFill(4.3), ['full', 'full', 'full', 'full', 'half']);
  assert.deepEqual(starFill(5), Array(5).fill('full'));
  assert.deepEqual(starFill(null), Array(5).fill('empty'));
  assert.deepEqual(starFill(9), Array(5).fill('full'));
});
