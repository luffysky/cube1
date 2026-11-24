import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createLinePaySandbox} from './line-pay.mjs';

test('LINE Pay signs exact sandbox requests and preserves numeric transaction IDs',async()=>{
 const secret='synthetic-channel-secret', id='2023042201206549310';
 const client=createLinePaySandbox({channelId:'test',channelSecret:secret,deviceProfileId:'test',
  fetchImpl:async(url,req)=>{
   const target=new URL(url);
   assert.equal(target.origin,'https://sandbox-api-pay.line.me');
   const expected=createHmac('sha256',secret).update(secret+target.pathname+req.body+req.headers['X-LINE-Authorization-Nonce']).digest('base64');
   assert.equal(req.headers['X-LINE-Authorization'],expected);
   if(target.pathname.endsWith('/confirm')) assert.equal(target.pathname,'/v4/payments/'+id+'/confirm');
   return new Response('{"returnCode":"0000","info":{"transactionId":'+id+',"paymentUrl":{"web":"https://sandbox-web-pay.line.me/web/payment/wait"}}}');
  }});
 const order=await client.checkout({orderId:'order-test',sku:'plus',itemName:'測試會員',amount:149});
 assert.equal(order.transactionId,id);
 assert.equal((await client.confirm({transactionId:id,amount:149})).transactionId,id);
});
