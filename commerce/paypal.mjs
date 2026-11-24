const origin='https://api-m.sandbox.paypal.com';
const portal='https://identity-staging.snowrealm.pet';

export function createPayPalSandbox({clientId,clientSecret,fetchImpl=fetch}) {
  if(!clientId||!clientSecret) throw Error('paypal_config_invalid');
  const call=async(path,options)=>{
    const response=await fetchImpl(origin+path,{...options,redirect:'error',signal:AbortSignal.timeout(12000)});
    if(!response.ok) throw Error('paypal_request_failed');
    return response.json();
  };
  async function orderRequest(path,requestId,body){
    if(!/^[a-zA-Z0-9_-]{1,36}$/.test(requestId??'')) throw Error('paypal_request_id_invalid');
    const {access_token}=await call('/v1/oauth2/token',{method:'POST',headers:{
      Authorization:'Basic '+Buffer.from(clientId+':'+clientSecret).toString('base64'),
      'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
    if(typeof access_token!=='string'||!access_token) throw Error('paypal_token_invalid');
    return call('/v2/checkout/orders'+path,{method:'POST',headers:{
      Authorization:'Bearer '+access_token,'Content-Type':'application/json','PayPal-Request-Id':requestId},
      body:JSON.stringify(body)});
  }
  const validId=id=>typeof id==='string'&&/^[A-Z0-9]{8,32}$/.test(id);
  function usd(cents){
    if(!Number.isSafeInteger(cents)||cents<1||cents>99999999) throw Error('paypal_amount_invalid');
    return {currency_code:'USD',value:Math.floor(cents/100)+'.'+String(cents%100).padStart(2,'0')};
  }
  return {
    async checkout({orderId,cents,requestId}){
      if(typeof orderId!=='string'||!orderId||orderId.length>80) throw Error('paypal_order_invalid');
      const order=await orderRequest('',requestId,{intent:'CAPTURE',purchase_units:[{reference_id:orderId,amount:usd(cents)}],
        payment_source:{paypal:{experience_context:{return_url:portal+'/commerce/paypal/return',cancel_url:portal+'/commerce/paypal/cancel'}}}});
      const approval=new URL(order.links?.find(link=>['payer-action','approve'].includes(link.rel))?.href);
      if(approval.origin!=='https://www.sandbox.paypal.com'||approval.username||approval.password||!validId(order.id)) throw Error('paypal_checkout_invalid');
      return {providerOrderId:order.id,url:approval.href};
    },
    // These arguments come from the persisted central order.
    async capture({providerOrderId,orderId,cents,requestId}){
      if(!validId(providerOrderId)) throw Error('paypal_order_invalid');
      const amount=usd(cents), order=await orderRequest('/'+providerOrderId+'/capture',requestId,{});
      const [unit]=order.purchase_units??[], [capture]=unit?.payments?.captures??[];
      if(order.id!==providerOrderId||order.status!=='COMPLETED'||order.purchase_units?.length!==1||
         unit.reference_id!==orderId||unit.payments?.captures?.length!==1||capture.status!=='COMPLETED'||
         capture.amount?.currency_code!==amount.currency_code||capture.amount?.value!==amount.value||!validId(capture.id)) {
        throw Error('paypal_capture_unconfirmed');
      }
      return {captureId:capture.id};
    },
  };
}
