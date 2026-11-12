// Tests for the i18n module: Spanish default, complete dictionaries.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { STRINGS, normalizeLang, t } = require('../src/i18n');

test('Spanish is the default language', () => {
  assert.equal(normalizeLang(undefined), 'es');
  assert.equal(normalizeLang(''), 'es');
  assert.equal(normalizeLang('fr'), 'es');
  assert.equal(normalizeLang('en-US'), 'en');
  assert.equal(normalizeLang('es-DO'), 'es');
});

test('every key exists in both languages', () => {
  const esKeys = Object.keys(STRINGS.es).sort();
  const enKeys = Object.keys(STRINGS.en).sort();
  assert.deepEqual(enKeys, esKeys);
});

test('list strings have the same length in both languages', () => {
  for (const key of Object.keys(STRINGS.es)) {
    if (Array.isArray(STRINGS.es[key])) {
      assert.equal(STRINGS.en[key].length, STRINGS.es[key].length, key);
    }
  }
});

test('t() falls back to the key itself for unknown keys', () => {
  assert.equal(t('en', 'pulse'), 'Pulse');
  assert.equal(t('es', 'pulse'), 'Pulso');
  assert.equal(t('es', 'does-not-exist'), 'does-not-exist');
});
