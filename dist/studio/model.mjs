/** Internal planning math. No requests, persistence, or payment integration. */
export const SCENARIOS = Object.freeze([
  Object.freeze({ id: 'small_hypothetical', label: '小規模', mau: 1000, supporterRate: 1, supporterPrice: 100, cosmeticOrders: 10, cosmeticPrice: 150, adImpressions: 1000, netEcpm: 60 }),
  Object.freeze({ id: 'medium_hypothetical', label: '中規模', mau: 10000, supporterRate: 2, supporterPrice: 100, cosmeticOrders: 200, cosmeticPrice: 150, adImpressions: 20000, netEcpm: 60 }),
  Object.freeze({ id: 'larger_hypothetical', label: '較大規模', mau: 50000, supporterRate: 2, supporterPrice: 100, cosmeticOrders: 1500, cosmeticPrice: 150, adImpressions: 150000, netEcpm: 60 }),
]);

const MAX_MONEY = Number.MAX_SAFE_INTEGER / 100;
const FIELDS = Object.freeze({
  mau: { label: '月活躍人數', integer: true },
  supporterRate: { label: '支持者比例', max: 100 },
  supporterPrice: { label: '支持者月單價', max: MAX_MONEY },
  cosmeticOrders: { label: '外觀訂單數', integer: true },
  cosmeticPrice: { label: '外觀平均單價', max: MAX_MONEY },
  adImpressions: { label: '有效付費曝光', integer: true },
  netEcpm: { label: '發行者淨 eCPM', max: MAX_MONEY },
  deductions: { label: '商品交易扣款 D', optional: true, max: MAX_MONEY },
  costs: { label: '營運成本 C', optional: true, max: MAX_MONEY },
});

export function scenarioInputs(id = SCENARIOS[0].id) {
  const source = SCENARIOS.find(scenario => scenario.id === id);
  if (!source) throw new RangeError('Unknown scenario');
  const { id: _id, label: _label, ...inputs } = source;
  return { ...inputs, deductions: '', costs: '' };
}

function parseValue(raw, definition) {
  if (raw == null || (typeof raw === 'string' && raw.trim() === '')) {
    return definition.optional ? { value: null } : { error: '請填寫數字；沒有收入時可填 0。' };
  }
  if (typeof raw !== 'number' && typeof raw !== 'string') return { error: '請輸入有效數字。' };
  if (typeof raw === 'string' && !/^[+\-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+\-]?\d+)?$/i.test(raw.trim())) {
    return { error: '請用數字輸入，不含逗號或貨幣符號。' };
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return { error: '請輸入有限且不小於 0 的數字。' };
  if (definition.integer && !Number.isInteger(value)) return { error: '人數、訂單及曝光請使用整數。' };
  const max = definition.max ?? Number.MAX_SAFE_INTEGER;
  if (value > max) return { error: definition.max === 100 ? '比例必須介於 0% 與 100%。' : '數值超出可安全計算的範圍。' };
  return { value };
}

const money = value => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateModel(raw = {}) {
  const inputs = {};
  const errors = {};
  for (const [name, definition] of Object.entries(FIELDS)) {
    const parsed = parseValue(raw?.[name], definition);
    if (parsed.error) errors[name] = parsed.error;
    else inputs[name] = parsed.value;
  }
  if (Object.keys(errors).length) return { valid: false, errors, inputs, results: null };

  const paidSupporters = Math.floor(inputs.mau * inputs.supporterRate / 100);
  const supporterGross = paidSupporters * inputs.supporterPrice;
  const cosmeticGross = inputs.cosmeticOrders * inputs.cosmeticPrice;
  const productGross = supporterGross + cosmeticGross;
  const adRevenue = inputs.adImpressions / 1000 * inputs.netEcpm;
  const beforeDeductions = productGross + adRevenue;
  const netRevenue = inputs.deductions === null ? null : beforeDeductions - inputs.deductions;
  const operatingResult = netRevenue === null || inputs.costs === null ? null : netRevenue - inputs.costs;
  const amounts = [supporterGross, cosmeticGross, productGross, adRevenue, beforeDeductions, netRevenue, operatingResult];
  if (!Number.isSafeInteger(paidSupporters) || amounts.some(value => value !== null && (!Number.isFinite(value) || Math.abs(value) > MAX_MONEY))) {
    return { valid: false, errors: { _model: '計算結果超出安全範圍，請降低輸入數值。' }, inputs, results: null };
  }

  return {
    valid: true,
    errors: {},
    inputs,
    results: {
      paidSupporters,
      supporterGross: money(supporterGross),
      cosmeticGross: money(cosmeticGross),
      productGross: money(productGross),
      adRevenue: money(adRevenue),
      beforeDeductions: money(beforeDeductions),
      netRevenue: netRevenue === null ? null : money(netRevenue),
      operatingResult: operatingResult === null ? null : money(operatingResult),
    },
  };
}

function initializeStudio() {
  const form = document.querySelector('[data-business-studio]');
  if (!form) return;
  const fields = Object.fromEntries(Object.keys(FIELDS).map(name => [name, form.elements.namedItem(name)]));
  const scenarioButtons = [...document.querySelectorAll('[data-scenario]')];
  const numberFormat = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 });
  const currency = value => `${value < 0 ? '−' : ''}NT$${numberFormat.format(Math.abs(value))}`;
  const setText = (id, text) => { document.getElementById(id).textContent = text; };

  function update() {
    const state = calculateModel(Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.value])));
    for (const [name, field] of Object.entries(fields)) {
      const error = state.errors[name];
      field.setAttribute('aria-invalid', error ? 'true' : 'false');
      setText(`${name}Error`, error || '');
    }
    const errorBox = document.getElementById('modelErrors');
    errorBox.hidden = state.valid;
    errorBox.textContent = state.valid ? '' : state.errors._model || '有輸入需要修正。請查看欄位下方說明。';
    for (const key of ['productGross', 'adRevenue', 'beforeDeductions', 'netRevenue', 'operatingResult']) {
      const element = document.getElementById(`${key}Value`);
      const value = state.valid ? state.results[key] : null;
      element.textContent = value === null ? '待確認' : currency(value);
      element.classList.toggle('is-negative', value !== null && value < 0);
      element.classList.toggle('is-unknown', value === null);
    }
    if (!state.valid) {
      setText('paidSupportersValue', '—');
      setText('supporterBreakdown', '修正欄位後重新試算');
      setText('cosmeticBreakdown', '—');
      setText('adBreakdown', '—');
      setText('resultState', '輸入待修正');
      setText('netRevenueHint', '請先修正輸入。');
      setText('operatingResultHint', '未以無效數字計算結果。');
      return;
    }
    const { inputs, results } = state;
    setText('paidSupportersValue', numberFormat.format(results.paidSupporters));
    setText('supporterBreakdown', `${numberFormat.format(results.paidSupporters)} 人 × ${currency(inputs.supporterPrice)} = ${currency(results.supporterGross)}`);
    setText('cosmeticBreakdown', `${numberFormat.format(inputs.cosmeticOrders)} 筆 × ${currency(inputs.cosmeticPrice)} = ${currency(results.cosmeticGross)}`);
    setText('adBreakdown', `${numberFormat.format(inputs.adImpressions)} 次 ÷ 1,000 × ${currency(inputs.netEcpm)}`);
    const unknown = [];
    if (inputs.deductions === null) unknown.push('交易扣款 D');
    if (inputs.costs === null) unknown.push('營運成本 C');
    setText('resultState', unknown.length ? '仍有未知項目' : '假設已填齊');
    setText('netRevenueHint', inputs.deductions === null ? '交易扣款 D 未填，淨營收保持未知。' : `扣交易費前合計 − ${currency(inputs.deductions)}（D）`);
    setText('operatingResultHint', unknown.length ? `尚缺${unknown.join('、')}；空白不當作 0。` : `淨營收 − ${currency(inputs.costs)}（C）；這是演算，非實際獲利。`);
  }

  function applyScenario(id) {
    const values = scenarioInputs(id);
    for (const [name, value] of Object.entries(values)) fields[name].value = value;
    for (const button of scenarioButtons) button.setAttribute('aria-pressed', String(button.dataset.scenario === id));
    setText('scenarioState', `${SCENARIOS.find(scenario => scenario.id === id).label}情境 · 全部數字皆為假設`);
    update();
  }

  for (const button of scenarioButtons) button.addEventListener('click', () => applyScenario(button.dataset.scenario));
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', () => {
    for (const button of scenarioButtons) button.setAttribute('aria-pressed', 'false');
    setText('scenarioState', '自訂假設 · 數值只留在這次頁面');
    update();
  });
  applyScenario(SCENARIOS[0].id);
}

if (typeof document !== 'undefined') initializeStudio();
