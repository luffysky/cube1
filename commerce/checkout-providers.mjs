import {createEcpaySandbox} from './ecpay.mjs';
import {createPayPalSandbox} from './paypal.mjs';
import {createLinePaySandbox} from './line-pay.mjs';

const providers = Object.freeze({
  ecpay: {currency:'TWD', factory:createEcpaySandbox},
  payuni: {currency:'TWD'},
  sunpay: {currency:'TWD'},
  paypal: {currency:'USD', factory:createPayPalSandbox},
  line_pay: {currency:'TWD', factory:createLinePaySandbox},
});

// Only instantiated by the server. The order's provider and currency come
// from its persisted checkout selection, and cannot change after creation.
export function resolveSandboxCheckout({provider, currency}, configuration) {
  const selected = Object.hasOwn(providers, provider) ? providers[provider] : null;
  if (!selected || currency !== selected.currency) throw Error('checkout_provider_currency_mismatch');
  if (!selected.factory || !Object.hasOwn(configuration, provider)) throw Error('checkout_provider_unavailable');
  return selected.factory(configuration[provider]);
}
