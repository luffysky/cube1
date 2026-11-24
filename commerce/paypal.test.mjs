import test from 'node:test';
import assert from 'node:assert/strict';
import {createPayPalSandbox} from './paypal.mjs';

test('sandbox capture matches the central order, amount and currency',async()=>{
 let currency='USD';
 const paypal=createPayPalSandbox({clientId:'synthetic-id',clientSecret:'synthetic-secret',fetchImpl:async(url,req)=>{
  const {origin,pathname}=new URL(url);
  assert.equal(origin,'https://api-m.sandbox.paypal.com');
  assert.equal(req.redirect,'error');
  if(pathname.endsWith('/token')) return Response.json({access_token:'fixture'});
  assert.equal(req.headers['PayPal-Request-Id'],'fixture-request-id');
  if(pathname.endsWith('/capture')) return Response.json({id:'PAYPALORDER',status:'COMPLETED',purchase_units:[
   {reference_id:'order-001',payments:{captures:[{id:'PAYPALCAPTURE',status:'COMPLETED',amount:{currency_code:currency,value:'4.99'}}]}}]});
  assert.equal(JSON.parse(req.body).purchase_units[0].amount.value,'4.99');
  return Response.json({id:'PAYPALORDER',links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow'}]});
 }});
 const data={orderId:'order-001',cents:499,requestId:'fixture-request-id'};
 const {providerOrderId}=await paypal.checkout(data);
 assert.deepEqual(await paypal.capture({...data,providerOrderId}),{captureId:'PAYPALCAPTURE'});
 currency='EUR';
 await assert.rejects(paypal.capture({...data,providerOrderId}),/paypal_capture_unconfirmed/);
});
