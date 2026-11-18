import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculateModel, scenarioInputs, SCENARIOS } from '../dist/studio/model.mjs';

const reference = JSON.parse(await readFile(new URL('../docs/unit-economics.json', import.meta.url), 'utf8'));

test('all three presets reproduce the independently recorded planning scenarios', () => {
  assert.equal(SCENARIOS.length, 3);
  for (const expected of reference.scenarios) {
    const state = calculateModel(scenarioInputs(expected.id));
    assert.equal(state.valid, true);
    assert.equal(state.results.paidSupporters, expected.paidSupporters);
    assert.equal(state.results.supporterGross, expected.supporterGrossNtd);
    assert.equal(state.results.cosmeticGross, expected.cosmeticGrossNtd);
    assert.equal(state.results.productGross, expected.grossProductReceiptsNtd);
    assert.equal(state.results.adRevenue, expected.adRevenueNtd);
    assert.equal(state.results.beforeDeductions, expected.revenueBeforeProductDeductionsNtd);
    assert.equal(state.results.netRevenue, null);
    assert.equal(state.results.operatingResult, null);
  }
});

test('unknown deductions and costs remain unknown, while explicit zero is calculated', () => {
  const raw = scenarioInputs();
  for (const blank of ['', '  ', null, undefined]) {
    const state = calculateModel({ ...raw, deductions: blank, costs: blank });
    assert.equal(state.valid, true);
    assert.equal(state.results.netRevenue, null);
    assert.equal(state.results.operatingResult, null);
  }
  const zero = calculateModel({ ...raw, deductions: '0', costs: 0 });
  assert.equal(zero.results.netRevenue, 2560);
  assert.equal(zero.results.operatingResult, 2560);
});

test('net revenue needs deductions; operating result needs both deductions and costs', () => {
  const raw = scenarioInputs();
  const knownD = calculateModel({ ...raw, deductions: 60 });
  assert.equal(knownD.results.netRevenue, 2500);
  assert.equal(knownD.results.operatingResult, null);
  const knownC = calculateModel({ ...raw, costs: 500 });
  assert.equal(knownC.results.netRevenue, null);
  assert.equal(knownC.results.operatingResult, null);
  const both = calculateModel({ ...raw, deductions: 60, costs: 3000 });
  assert.equal(both.results.netRevenue, 2500);
  assert.equal(both.results.operatingResult, -500);
});

test('supporters are floored from MAU times percentage without rounding up a person', () => {
  const state = calculateModel({ ...scenarioInputs(), mau: 999, supporterRate: 1.5 });
  assert.equal(state.results.paidSupporters, 14);
  assert.equal(state.results.supporterGross, 1400);
  const exact = calculateModel({ ...scenarioInputs(), mau: 100, supporterRate: 29 });
  assert.equal(exact.results.paidSupporters, 29);
});

test('a zero-activity scenario has zero revenue and can still incur a loss', () => {
  const state = calculateModel({ ...scenarioInputs(), mau: 0, supporterRate: 0, cosmeticOrders: 0, adImpressions: 0, deductions: 0, costs: 100 });
  assert.equal(state.valid, true);
  assert.equal(state.results.productGross, 0);
  assert.equal(state.results.adRevenue, 0);
  assert.equal(state.results.netRevenue, 0);
  assert.equal(state.results.operatingResult, -100);
});

test('negative, non-finite, malformed and non-numeric inputs do not produce a result', () => {
  for (const value of [-1, Infinity, -Infinity, NaN, 'Infinity', 'NaN', '1,000', '0x10', true, {}, []]) {
    const state = calculateModel({ ...scenarioInputs(), supporterPrice: value });
    assert.equal(state.valid, false, `must reject ${String(value)}`);
    assert.ok(state.errors.supporterPrice);
    assert.equal(state.results, null);
  }
  assert.equal(calculateModel({ ...scenarioInputs(), deductions: -1 }).valid, false);
  assert.equal(calculateModel({ ...scenarioInputs(), costs: Infinity }).valid, false);
});

test('required blanks, fractional counts and percentages above 100 are rejected', () => {
  for (const name of ['mau', 'supporterRate', 'supporterPrice', 'cosmeticOrders', 'cosmeticPrice', 'adImpressions', 'netEcpm']) {
    const state = calculateModel({ ...scenarioInputs(), [name]: '' });
    assert.equal(state.valid, false);
    assert.ok(state.errors[name]);
  }
  for (const name of ['mau', 'cosmeticOrders', 'adImpressions']) {
    assert.equal(calculateModel({ ...scenarioInputs(), [name]: 1.5 }).valid, false);
  }
  assert.equal(calculateModel({ ...scenarioInputs(), supporterRate: 100.01 }).valid, false);
  assert.equal(calculateModel({ ...scenarioInputs(), supporterRate: 100 }).valid, true);
});

test('unsafe input or overflowing totals fail visibly instead of showing an enormous result', () => {
  assert.equal(calculateModel({ ...scenarioInputs(), mau: Number.MAX_SAFE_INTEGER + 1 }).valid, false);
  const state = calculateModel({ ...scenarioInputs(), mau: Number.MAX_SAFE_INTEGER, supporterRate: 100, supporterPrice: 100 });
  assert.equal(state.valid, false);
  assert.ok(state.errors._model);
  assert.equal(state.results, null);
});

test('currency keeps cents and does not deduct ad platform share a second time', () => {
  const state = calculateModel({ ...scenarioInputs(), mau: 100, supporterRate: 1, supporterPrice: 99.5, cosmeticOrders: 1, cosmeticPrice: 149.25, adImpressions: 250, netEcpm: 60, deductions: 3.75, costs: 10.5 });
  assert.equal(state.results.productGross, 248.75);
  assert.equal(state.results.adRevenue, 15);
  assert.equal(state.results.netRevenue, 260);
  assert.equal(state.results.operatingResult, 249.5);
});
