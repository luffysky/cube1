import {createHmac,randomUUID} from 'node:crypto';

const api='https://sandbox-api-pay.line.me';
const portal='https://identity-staging.snowrealm.pet';

export function createLinePaySandbox({channelId,channelSecret,deviceProfileId,fetchImpl=fetch}) {
  if (!channelId||!channelSecret||!deviceProfileId) throw Error('line_pay_config_invalid');

  async function post(path,data,timeout) {
    const body=JSON.stringify(data), nonce=randomUUID();
    const signature=createHmac('sha256',channelSecret).update(channelSecret+path+body+nonce).digest('base64');
    const response=await fetchImpl(api+path,{method:'POST',body,redirect:'error',signal:AbortSignal.timeout(timeout),
      headers:{'Content-Type':'application/json','X-LINE-ChannelId':channelId,
        'X-LINE-Authorization':signature,'X-LINE-Authorization-Nonce':nonce,
        'X-LINE-MerchantDeviceProfileId':deviceProfileId}});
    if(!response.ok) throw Error('line_pay_http_failed');
    // LINE Pay returns 19-digit transaction IDs as JSON numbers.
    const result=JSON.parse(await response.text(),(key,value,context)=>
      key==='transactionId'&&typeof value==='number' ? context.source : value);
    if(result?.returnCode!=='0000') throw Error('line_pay_request_failed');
    return result.info;
  }

  const money=amount=>{
    if(!Number.isSafeInteger(amount)||amount<1) throw Error('line_pay_amount_invalid');
    return {amount,currency:'TWD'};
  };
  return {
    async checkout({orderId,sku,itemName,amount}) {
      if(!/^[A-Za-z0-9_.:-]{6,80}$/.test(orderId??'')||!/^[a-z0-9][a-z0-9_.-]{0,79}$/.test(sku??'')||
        typeof itemName!=='string'||!itemName.trim()||itemName.length>100) throw Error('line_pay_order_invalid');
      const info=await post('/v4/payments/request',{...money(amount),orderId,
        packages:[{id:'1',amount,products:[{id:sku,name:itemName,quantity:1,price:amount}]}],
        redirectUrls:{confirmUrl:portal+'/commerce/line-pay/confirm',cancelUrl:portal+'/commerce/line-pay/cancel'}},10000);
      const paymentUrl=new URL(info.paymentUrl.web);
      if(paymentUrl.origin!=='https://sandbox-web-pay.line.me'||paymentUrl.username||paymentUrl.password||
        typeof info.transactionId!=='string'||!/^\d{1,20}$/.test(info.transactionId)) throw Error('line_pay_response_invalid');
      return {transactionId:info.transactionId,url:paymentUrl.href};
    },
    // Both values must come from the stored order, never directly from the browser return.
    confirm({transactionId,amount}) {
      if(typeof transactionId!=='string'||!/^\d{1,20}$/.test(transactionId)) throw Error('line_pay_transaction_invalid');
      return post('/v4/payments/'+transactionId+'/confirm',money(amount),40000);
    },
  };
}
