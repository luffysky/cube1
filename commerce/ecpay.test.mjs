import test from 'node:test';
import assert from 'node:assert/strict';
import {createEcpaySandbox} from './ecpay.mjs';

test('checkout uses the sandbox, Taiwan date, and verifies check values without accepting alterations',()=>{
 const adapter=createEcpaySandbox({merchantId:'1234567',hashKey:'synthetic-test-key',hashIV:'synthetic-test-iv',
  returnUrl:'https://identity-staging.snowrealm.pet/commerce/result',
  periodReturnUrl:'https://identity-staging.snowrealm.pet/commerce/renew'});
 const order={tradeNo:'B001',amount:149,itemName:'測試會員',createdAt:new Date('2026-11-24T16:12:00Z'),cycles:12};
 const checkout=adapter.checkout(order);
 assert.equal(new URL(checkout.url).hostname,'payment-stage.ecpay.com.tw');
 assert.equal(checkout.fields.MerchantTradeDate,'2026/11/25 00:12:00');
 assert.equal(checkout.fields.PeriodAmount,149);
 const form=new URLSearchParams(checkout.fields).toString();
 assert.equal(adapter.verifyNotification(form).MerchantTradeNo,'B001');
 assert.equal(adapter.verifyNotification(form.replace('TotalAmount=149','TotalAmount=299')),null);
 assert.equal(adapter.verifyNotification(form+'&merchantid=1234567'),null);
 assert.throws(()=>adapter.checkout({...order,amount:0}),/ecpay_order_invalid/);
});
