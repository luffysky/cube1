import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSandboxCheckout} from './checkout-providers.mjs';

test('central checkout rejects currency changes and keeps incomplete integrations unavailable',()=>{
  const configuration={paypal:{clientId:'fixture',clientSecret:'fixture'}};
  assert.equal(typeof resolveSandboxCheckout({provider:'paypal',currency:'USD'},configuration).capture,'function');
  assert.throws(()=>resolveSandboxCheckout({provider:'paypal',currency:'TWD'},configuration),/currency_mismatch/);
  for(const provider of ['payuni','sunpay','ecpay','line_pay']){
    assert.throws(()=>resolveSandboxCheckout({provider,currency:'TWD'},configuration),/provider_unavailable/);
  }
});
