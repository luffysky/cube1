// Regulatory orientation only, NOT a legal clearance or a substitute for local counsel.
// Keep source links current before entering a new jurisdiction or adding monetization/chat.
export const REGION_POLICIES=Object.freeze({
tw:{name:'臺灣 Taiwan',headline:'臺灣：個人資料與消費者保護',summary:'依《個人資料保護法》履行蒐集告知與資料安全義務；遊戲正式營運／付費時，須另核對遊戲軟體分級與消費者保護事項。',gap:'尚缺營運者法定名稱、申訴／刪除資料管道、資料保留期限及正式分級／付款政策驗收。',sources:[['個人資料保護法','https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=I0050021']]},
cn:{name:'中國大陸 Mainland China',headline:'中國大陸：遊戲實名與防沉迷',summary:'網路遊戲正式提供涉及實名核驗、防沉迷接入、未成年人時段限制及出版／遊戲發行資格。自填年齡、地區或 Cookie 同意不能取代法定核驗。',gap:'未接官方實名／防沉迷、未核實遊戲出版發行資格，不能宣稱符合中國大陸正式營運要求；對自選中國大陸的使用者應避免開放正式線上遊戲服務。',sources:[['國家新聞出版署 2021 通知','https://www.nppa.gov.cn/xxfb/tzgs/202108/t20210830_666285.html']]},
jp:{name:'日本 Japan',headline:'日本：APPI 與未成年人同意',summary:'日本個人情報保護法及主管機關指引適用；未成年人是否可自行同意應依資料性質、服務情境與理解能力評估，並非一律同一歲數。',gap:'尚未建立必要時的法定代理人同意流程、日文正式告知審查與資料跨境評估。',sources:[['個人情報保護委員会 FAQ','https://www.ppc.go.jp/personalinfo/faq/APPI_QA/']]},
kr:{name:'韓國 South Korea',headline:'韓國：PIPA 與遊戲分級',summary:'韓國處理未滿 14 歲兒童個資，依法需確認法定代理人同意的適用情形；公開發行遊戲亦須檢視 GRAC／GCRB 分級與適用例外。',gap:'尚無監護人同意與核實程序、韓文法律正式文本審核及當地遊戲分級驗收。',sources:[['PIPA 第 22-2 條','https://elaw.klri.re.kr/eng_service/lawViewContent.do?hseq=62389'],['Game Content Rating Board','https://www.gcrb.or.kr/english/enforcement/Enforcement.aspx']]},
my:{name:'馬來西亞 Malaysia',headline:'馬來西亞：PDPA 與監護人同意',summary:'馬來西亞 PDPA 與 2013 規則的個資處理同意要求，涉及未滿 18 歲資料主體時應取得家長／監護人同意；通知語言與個資跨境規範亦需審查。',gap:'未實作可驗證的家長／監護人同意、馬來文及英文正式隱私告知與跨境義務評估。',sources:[['PDPA Regulations 2013','https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2024/07/Peraturan-peraturan-Perlindungan-Data-Peribadi.pdf'],['2024 修正法','https://www.pdp.gov.my/en/akta/personal-data-protection-amendment-act-2024/']]},
sg:{name:'新加坡 Singapore',headline:'新加坡：PDPA 兒童資料指引',summary:'新加坡 PDPC 認為 13–17 歲在理解資料處理與撤回後果時可能自行有效同意；未滿 13 歲通常宜由家長／監護人同意，仍須按情境個別評估。',gap:'尚無家長同意及兒童易讀告知的完整驗證程序；亦需確立資料保護聯絡窗口。',sources:[['PDPC 兒童資料指引','https://www.pdpc.gov.sg/-/media/files/pdpc/pdf-files/advisory-guidelines/advisory-guidelines-on-the-pdpa-for-children%27s-personal-data-in-the-digital-environment_mar24.pdf']]},
au:{name:'澳洲 Australia',headline:'澳洲：兒童隱私與線上安全',summary:'澳洲社群平台未滿 16 歲限制通常排除以網路遊戲為主要目的的服務，不能誤稱遊戲玩家一律需滿 16 歲。兒童線上隱私守則預定 2026 年 12 月完成，需持續追蹤。',gap:'需評估 Privacy Act 適用性、兒童隱私守則實施後要求、報告與遊戲社交功能風險。',sources:[['eSafety 線上遊戲例外','https://www.esafety.gov.au/about-us/industry-regulation/social-media-age-restrictions'],['OAIC 兒童隱私守則進度','https://www.oaic.gov.au/privacy/privacy-registers/privacy-codes/childrens-online-privacy-code']]},
us:{name:'美國 United States',headline:'美國：COPPA 與州別差異',summary:'COPPA 對面向未滿 13 歲兒童或明知蒐集其個資的服務規範，通常需可驗證家長同意；個別州的隱私、青少年與自動續訂要求另行適用。',gap:'未做 COPPA 家長核實、州別權利請求流程／法律評估；不得把自填年齡視為通過 COPPA。',sources:[['FTC COPPA 指引','https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions']]},
uk:{name:'英國 United Kingdom',headline:'英國：Children’s Code／Online Safety',summary:'英國 ICO Children’s Code 對兒童可能使用的網路遊戲要求高隱私預設與適齡設計；有玩家互動等功能時需評估 Ofcom Online Safety Act 的義務。',gap:'尚缺英國兒童風險／存取評估、適齡設計紀錄、必要的保障及審查機制。',sources:[['ICO Children’s Code','https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/introduction-to-the-childrens-code/'],['Ofcom 兒童安全義務','https://www.ofcom.org.uk/online-safety/protecting-children/protection-of-children-duties-under-the-online-safety-act']]},
other:{name:'其他地區 Other regions',headline:'其他地區：一般隱私與消費者保障',summary:'須依實際玩家所在地與營運模式核對適用個資、遊戲分級、消費者及未成年人規則；單純選國家並非法律判定。',gap:'尚未評估具體國家／地區法律，正式發行前需逐國審查。',sources:[]}
});
export const REGIONS=Object.freeze(Object.keys(REGION_POLICIES));
export const AGE_GROUPS=Object.freeze(['under13','13','14-15','16-17','adult']);
export function legalWarning(region,age){
 if(!REGIONS.includes(region))return null;
 if(!AGE_GROUPS.includes(age))return null;
 const minor=age!=='adult';
 if(region==='cn')return '中國大陸尚未完成正式網路遊戲的實名、防沉迷及發行資格核驗；此頁不能開通相關正式線上服務。';
 if(region==='my'&&minor)return '馬來西亞未滿 18 歲的個資同意涉及監護人同意；本站尚未提供正式驗證流程。';
 if(region==='kr'&&['under13','13'].includes(age))return '韓國未滿 14 歲的個資同意可能需要經確認的法定代理人同意；本站尚未完成。';
 if(region==='us'&&age==='under13')return '美國 COPPA 可能要求可驗證的家長同意；本站尚未提供。';
 if(region==='sg'&&age==='under13')return '新加坡未滿 13 歲兒童的個資同意建議由家長／監護人辦理；本站尚無驗證流程。';
 if(region==='uk'&&minor)return '英國兒童隱私與線上安全義務尚未完成產品層級審查；請勿視為已符合。';
 if(region==='jp'&&minor)return '日本的法定代理人同意須按資料及服務情況評估，不是單用一個年齡閾值判定。';
 if(region==='au'&&minor)return '澳洲一般網路遊戲通常不受社群平台 16 歲限制直接禁止，但兒童隱私等義務仍須評估。';
 return minor?'未成年玩家可能需要監護人協助及額外個資保護；本站尚未完成所有司法管轄區的核實程序。':'地區提示僅供資訊參考，未表示已完成當地法律審查。';
}
