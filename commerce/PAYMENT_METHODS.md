# SnowRealm Games checkout providers

ECPay, PAYUNi and SunPay are intended to charge TWD, including eligible foreign-issued cards where the merchant agreement enables them. PayPal is the USD cross-border option. LINE Pay remains a separate TWD method. Foreign-issued cards and foreign-currency pricing are separate capabilities.

The sandbox resolver only exposes configured, implemented adapters. PAYUNi and SunPay remain unavailable while their adapters and notification reconciliation are pending. Confirm the provider, amount, currency and merchant order reference before any entitlement is issued. Store provider order IDs with the central order and use the original payment provider for refunds.

- PAYUNi UPP sandbox: https://sandbox-api.payuni.com.tw/api/upp
- SunPay developer portal and test account: https://www.sunpay.com.tw/developers
- PayPal Orders API: https://developer.paypal.com/api/orders/v2

Production requires approved merchant accounts, foreign-card approval where relevant, and a successful end-to-end staging run for each method. No commercial fees or checkout registrations have been accepted.
