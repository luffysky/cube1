import {createHash,timingSafeEqual} from 'node:crypto';

const checkoutUrl='https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5';
const taipeiTime=new Intl.DateTimeFormat('en-GB',{
  timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',
});

function merchantDate(date) {
  const parts=Object.fromEntries(taipeiTime.formatToParts(date).map(({type,value})=>[type,value]));
  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function createEcpaySandbox({merchantId,hashKey,hashIV,returnUrl,periodReturnUrl}) {
  if (!/^\d{7}$/.test(merchantId) || !hashKey || !hashIV) throw Error('ecpay_config_invalid');
  const callback=url=>{
    const value=new URL(url);
    if(value.protocol!=='https:'||value.origin!=='https://identity-staging.snowrealm.pet'||
       value.username||value.password||value.hash) throw Error('ecpay_callback_invalid');
    return value.href;
  };
  const notify=callback(returnUrl), renew=periodReturnUrl?callback(periodReturnUrl):null;
  function mac(fields) {
    const sorted=Object.keys(fields).filter(key=>key!=='CheckMacValue')
      .sort((a,b)=>a.toLowerCase()<b.toLowerCase()?-1:a.toLowerCase()>b.toLowerCase()?1:0);
    const raw=sorted.map(key=>key+'='+fields[key]).join('&');
    const encoded=encodeURIComponent('HashKey='+hashKey+'&'+raw+'&HashIV='+hashIV)
      .replace(/%20/g,'+').replace(/'/g,'%27').replace(/~/g,'%7E').toLowerCase();
    return createHash('sha256').update(encoded).digest('hex').toUpperCase();
  }
  return {
    // Input must come from a server-side order snapshot of the product catalogue.
    checkout({tradeNo,amount,itemName,createdAt,cycles}) {
      if(!/^[A-Za-z0-9]{1,20}$/.test(tradeNo)||!Number.isSafeInteger(amount)||amount<1||
         typeof itemName!=='string'||!itemName.trim()||itemName.length>100||
         !(createdAt instanceof Date)||!Number.isFinite(+createdAt)) throw Error('ecpay_order_invalid');
      const fields={MerchantID:merchantId,MerchantTradeNo:tradeNo,MerchantTradeDate:merchantDate(createdAt),
        PaymentType:'aio',TotalAmount:amount,TradeDesc:'SnowRealm Games',ItemName:itemName,
        ReturnURL:notify,ChoosePayment:'Credit',EncryptType:1};
      if(cycles!==undefined){
        if(!renew||!Number.isInteger(cycles)||cycles<2||cycles>99) throw Error('ecpay_recurring_invalid');
        Object.assign(fields,{PeriodAmount:amount,PeriodType:'M',Frequency:1,ExecTimes:cycles,PeriodReturnURL:renew});
      }
      return {url:checkoutUrl,method:'POST',fields:{...fields,CheckMacValue:mac(fields)}};
    },
    verifyNotification(form) {
      if(typeof form!=='string'||Buffer.byteLength(form)>16384) return null;
      const entries=[...new URLSearchParams(form)];
      if(new Set(entries.map(([key])=>key.toLowerCase())).size!==entries.length) return null;
      const fields=Object.fromEntries(entries);
      if(fields.MerchantID!==merchantId||!/^[A-F0-9]{64}$/.test(fields.CheckMacValue??'')) return null;
      if(!timingSafeEqual(Buffer.from(mac(fields)),Buffer.from(fields.CheckMacValue))) return null;
      // A valid notification is a signal to reconcile with the provider, never an entitlement.
      return fields;
    },
  };
}
