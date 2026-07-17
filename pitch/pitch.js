'use strict';
const pptxgen = require('pptxgenjs');
const path = require('path');
const os = require('os');
const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.title = 'Pabandi — Alibaba CoCreate 2026';
pres.author = 'Pabandi';

const repoDir = path.dirname(path.resolve(__dirname));

const W = 10, H = 5.625;
const BG = '08080c';
const PANEL = '13131b';
const ACCENT = '1a1a2e';
const CYAN = '00f2ff';
const PINK = 'ff2b95';
const WHITE = 'ffffff';
const MUTED = 'b8bcc8';
const YELLOW = 'fbbf24';

const mkShadow = () => ({type:'outer',blur:14,offset:4,angle:135,color:'000000',opacity:0.5});

function header(s, label){
  s.background = {color:BG};
  s.addShape(pres.shapes.RECTANGLE,{x:0,y:0.22,w:W,h:0.56,fill:{color:ACCENT}});
  s.addText('Pabandi',{x:0.4,y:0.26,w:2.2,h:0.44,fontSize:16,fontFace:'Arial',color:CYAN,bold:true,margin:0});
  s.addText('Alibaba CoCreate 2026 · Agentic Business Track',{x:2.5,y:0.26,w:5.0,h:0.44,fontSize:13.5,color:WHITE,margin:0});
  s.addText('CoCreate 2026',{x:7.62,y:0.26,w:1.98,h:0.44,fontSize:11,color:MUTED,align:'right',margin:0});

  s.addShape(pres.shapes.RECTANGLE,{x:0.4,y:0.92,w:0.22,h:0.4,fill:{color:CYAN}});
  s.addText(label,{x:0.74,y:0.94,w:8.8,h:0.36,fontSize:14,color:MUTED,margin:0});
}

function brandHeadline(s, text, sub){
  s.addText(text,{x:0.4,y:1.02,w:9.2,h:0.52,fontSize:28,fontFace:'Arial',color:WHITE,bold:true,margin:0,lineSpacingMultiple:1.12});
  if(sub) s.addText(sub,{x:0.4,y:sub?1.56:1.56,w:9.2,h:0.26,fontSize:13,color:MUTED,margin:0});
  s.addShape(pres.shapes.RECTANGLE,{x:0.4,y:1.56,w:9.2,h:0.04,fill:{color:CYAN},transparency:60});
}

function footer(s){
}

function card(s,x,y,w,h,title,body,accent=CYAN){
  s.addShape(pres.shapes.RECTANGLE,{x,y,w,h,fill:{color:PANEL},shadow:mkShadow()});
  s.addShape(pres.shapes.RECTANGLE,{x,y,w:0.1,h,fill:{color:accent}});
  if(title){
    s.addText(title,{x:x+0.24,y:y+0.14,w:w-0.34,h:0.3,fontSize:15,fontFace:'Arial',color:accent,bold:true,margin:0});
  }
  if(body){
    s.addText(body,{x:x+0.24,y:y+(title?0.48:0.14),w:w-0.34,h:h-(title?0.62:0.24),fontSize:13.5,color:WHITE,margin:0});
  }
}

function foot(s){
  s.addText('pabandi.app',{x:0.4,y:5.22,w:2.2,h:0.2,fontSize:9.5,color:MUTED,margin:0});
  s.addText('Confidential · Alibaba CoCreate 2026',{x:6.2,y:5.22,w:3.4,h:0.2,fontSize:9.5,color:MUTED,align:'right',margin:0});
  s.addShape(pres.shapes.RECTANGLE,{x:0,y:5.44,w:W,h:0.08,fill:{color:CYAN},transparency:50});
}

// ========== SLIDES ==========

// 1 TITLE
const s1=pres.addSlide(); s1.background={color:BG};
s1.addShape(pres.shapes.RECTANGLE,{x:0,y:1.52,w:W,h:1.92,fill:{color:PANEL,transparency:30}});
s1.addShape(pres.shapes.RECTANGLE,{x:0,y:1.52,w:0.6,h:1.92,fill:{color:CYAN}});
s1.addShape(pres.shapes.RECTANGLE,{x:0.6,y:1.52,w:0.12,h:1.92,fill:{color:PINK}});
s1.addText('Pabandi',{x:0.9,y:1.62,w:2.2,h:0.36,fontSize:14,color:CYAN,bold:true,margin:0});
s1.addText('Programmable Trust\nfor the Service Economy',{x:0.9,y:2.0,w:8.0,h:1.02,fontSize:38,fontFace:'Arial',color:WHITE,bold:true,margin:0,lineSpacingMultiple:1.12});
s1.addText('Alibaba CoCreate 2026 · Agentic Business Track',{x:0.9,y:3.12,w:8.0,h:0.36,fontSize:16,color:CYAN,margin:0});
s1.addText('Pakistan → Alibaba Ecosystem → Global',{x:0.9,y:3.58,w:8.0,h:0.28,fontSize:14,color:MUTED,margin:0});
s1.addShape(pres.shapes.RECTANGLE,{x:0,y:5.36,w:W,h:0.12,fill:{color:PINK}});

// 2 PROBLEM
const p1=pres.addSlide(); header(p1,'The Problem');
brandHeadline(p1,'$50B+ lost annually to trust failures in informal commerce');
card(p1,0.4,1.7,2.92,1.3,'16–30% loss rate','Live-sale and COD orders fail at scale.\nNo credit history + no deposits = high friction.',CYAN);
card(p1,3.52,1.7,2.92,1.3,'The brutal choice','Prepay → lose majority of orders.\nTrust blindly → lose revenue to no-shows.\nSell only to friends → cannot scale.',PINK);
card(p1,6.64,1.7,2.92,1.3,'No portable trust','Scores don\'t travel across platforms.\nLoyalty is siloed and unredeemable elsewhere.',CYAN);
p1.addText('Speaker tip: open with Karachi live-seller story — 8 of 50 recent orders never paid or arrived.',{x:0.4,y:3.16,w:9.2,h:0.24,fontSize:12,color:MUTED,margin:0,italic:true});
foot(p1);

// 3 MARKET
const p2=pres.addSlide(); header(p2,'The Market');
brandHeadline(p2,'Pakistan-first lab · Alibaba-ready architecture');
card(p2,0.4,1.62,4.44,2.0,'Pakistan first','20M+ freelancers\n500K+ salons, clinics, services\nWhatsApp-native commerce\nNo incumbent credit outside formal banks',CYAN);
card(p2,5.12,1.62,4.48,2.0,'Global scale now','$1.1T live-commerce by 2026\n$5T+ informal economy in EM\nAI + on-chain trust without KYC\nPakistan = proving ground',PINK);
foot(p2);

// 4 SOLUTION
const p3=pres.addSlide(); header(p3,'The Solution');
brandHeadline(p3,'Reliability Passport · AI Prediction · Merchant API');
card(p3,0.4,1.66,2.92,1.14,'Reliability Passport','On-chain portable trust score built from real behavior.',CYAN);
card(p3,3.52,1.66,2.92,1.14,'AI Predictor','No-show risk model trained on Pakistan transaction patterns.',CYAN);
card(p3,6.64,1.66,2.92,1.14,'Merchant API','2-second verification for Shopify, Daraz, live-sale checkout.',CYAN);
card(p3,0.4,2.94,2.92,1.02,'$PAB tokens','Punctuality rewards + merchant rebates + community loyalty.',PINK);
card(p3,3.52,2.94,2.92,1.02,'ZK Layer','Hash-verified identity without exposing raw user data.',PINK);
card(p3,6.64,2.94,2.92,1.02,'Web3 Native','Phantom / Solflare for deposits + rewards.',PINK);
p3.addText('Speaker tip: walk through one buyer journey — earns score → seller verifies in 2 secs → proceeds with or without deposit.',{x:0.4,y:4.1,w:9.2,h:0.24,fontSize:12,color:MUTED,margin:0,italic:true});
foot(p3);

// 5 FLYWHEEL
const p4=pres.addSlide(); header(p4,'The Flywheel');
brandHeadline(p4,'Every participant strengthens the entire network');
const fly=[
  {t:'Users',h:'Build trust score'},
  {t:'Merchants',h:'Verify in 2s'},
  {t:'Platforms',h:'Integrate Passport'},
  {t:'Network',h:'Better AI → more trust'},
  {t:'On-chain',h:'Audit trail'}
];
const CW=1.9, GAP=0.12, START=(W-(fly.length*CW+(fly.length-1)*GAP))/2;
fly.forEach((f,i)=>{
  const x=START+i*(CW+GAP), y=1.66;
  p4.addShape(pres.shapes.RECTANGLE,{x,y,w:CW,h:1.76,fill:{color:PANEL},shadow:mkShadow()});
  p4.addShape(pres.shapes.RECTANGLE,{x,y,w:CW,h:0.1,fill:{color:i%2?PINK:CYAN}});
  p4.addShape(pres.shapes.RECTANGLE,{x:x+0.18,y:y+0.18,w:0.56,h:0.56,fill:{color:ACCENT}});
  const icons=['👤','🛒','🔌','📈','⛓'];
  p4.addText(icons[i],{x:x+0.18,y:y+0.2,w:0.56,h:0.52,fontSize:18,margin:0,align:'center',valign:'middle'});
  p4.addText(f.t,{x:x+0.82,y:y+0.2,w:CW-1.0,h:0.26,fontFace:'Arial',color:CYAN,bold:true,margin:0,fontSize:12});
  p4.addText(f.h,{x:x+0.14,y:y+0.88,w:CW-0.28,h:0.34,fontSize:13,color:WHITE,bold:true,margin:0});
  p4.addText('Real transactions create immutable trust history that travels with the user.',{x:x+0.14,y:y+1.28,w:CW-0.28,h:0.3,fontSize:11.5,color:MUTED,margin:0});
});
p4.addText('Once Pabandi is the default trust layer, switching costs are enormous.',{x:0.4,y:3.58,w:9.2,h:0.36,fontSize:15,color:CYAN,bold:true,margin:0});
foot(p4);

// 6 TRACTION
const p5=pres.addSlide(); header(p5,'Traction');
brandHeadline(p5,'Validated in Pakistan\'s informal economy — ready for Alibaba ecosystem');
[{n:'API',v:'5 live endpoints · 2 SDKs · docs',x:0.4},{n:'Pilots',v:'Karachi/Lahore beta talks in motion',x:3.52},{n:'Integrations',v:'Daraz scoped · Shopify ready',x:6.64}].forEach(m=>{
  p5.addShape(pres.shapes.RECTANGLE,{x:m.x,y:1.26,w:2.98,h:0.58,fill:{color:PANEL}});
  p5.addShape(pres.shapes.RECTANGLE,{x:m.x,y:1.26,w:0.1,h:0.58,fill:{color:CYAN}});
  p5.addText(m.n,{x:m.x+0.2,y:1.32,w:2.68,h:0.22,fontSize:14,fontFace:'Arial',color:CYAN,bold:true,margin:0});
  p5.addText(m.v,{x:m.x+0.2,y:1.56,w:2.68,h:0.2,fontSize:12.5,color:WHITE,margin:0});
});
[{t:'Live infra',b:'Cloud Run hardened · Firebase Auth + Prisma',x:0.4,a:CYAN},
 {t:'Web3',b:'Solana mainnet token · Escrow + Soulbound',x:3.52,a:PINK},
 {t:'Integrations',b:'Daraz scoped · Shopify ready · WhatsApp live',x:6.64,a:CYAN},
 {t:'Content engine',b:'90-day calendar · launch threads · outreach playbooks',x:0.4,a:PINK},
 {t:'Docs + SDKs',b:'Developer portal · API reference · 1-pagers',x:3.52,a:CYAN},
 {t:'Business CRM',b:'Odoo JSON-RPC · Cal.com webhooks',x:6.64,a:PINK}
].forEach(c=>card(p5,c.x,2.06,2.92,1.0,c.t,c.b,c.a));
foot(p5);

// 7 COMPETITION
const p6=pres.addSlide(); header(p6,'Competitive Moat');
brandHeadline(p6,'AI + on-chain behavior = moat no competitor has');
card(p6,0.4,1.66,2.92,1.1,'Pabandi','AI-observed real behavior · Passport API · EM first',CYAN);
card(p6,3.52,1.66,2.92,1.1,'Ethos','Web3 social signals · no merchant API',PINK);
card(p6,6.64,1.66,2.92,1.1,'Orange','Protocol aggregation · no scoring',PINK);
card(p6,0.4,2.9,4.1,1.1,'Fuero','Credit bureau · US-only',PINK);
card(p6,4.72,2.9,4.0,1.1,'Cheqd / others','Enterprise identity · no merchant reliability',PINK);
p6.addText('Ethos scores your Twitter activism. Orange scores token swaps. Pabandi tracks whether you showed up and paid.',{x:0.4,y:4.18,w:9.2,h:0.28,fontSize:13.5,color:CYAN,margin:0,italic:true});
foot(p6);

// 8 INTEGRATION
const p7=pres.addSlide(); header(p7,'Alibaba Integration Path');
brandHeadline(p7,'Pabandi plugs directly into Alibaba\'s commerce stack');
[
  ['Daraz / SEA','COD rejection losses + seller confidence','Daraz'],
  ['Alibaba.com B2B','Supplier reliability for cross-border trade','1688'],
  ['1688 / AliExpress','Buyer/seller trust in emerging markets','AliExpress'],
  ['Temu','Same COD reliability problem at global scale','Temu']
].forEach((item,i)=>{
  const row=Math.floor(i/2), col=i%2;
  const x=0.4+col*4.82, y=1.66+row*1.52, w=4.6, h=1.36;
  p7.addShape(pres.shapes.RECTANGLE,{x,y,w,h,fill:{color:PANEL},shadow:mkShadow()});
  p7.addShape(pres.shapes.RECTANGLE,{x,y,w:0.12,h,fill:{color:CYAN}});
  p7.addText(item[0],{x:x+0.24,y:y+0.16,w:w-0.36,h:0.34,fontSize:16,fontFace:'Arial',color:WHITE,bold:true,margin:0});
  p7.addText(item[1],{x:x+0.24,y:y+0.6,w:w-0.36,h:0.62,fontSize:13.5,color:MUTED,margin:0});
  p7.addText(item[2],{x:x+0.24,y:y+1.14,w:w-0.36,h:0.2,fontSize:12,color:CYAN,bold:true,margin:0});
});
p7.addShape(pres.shapes.RECTANGLE,{x:0.4,y:5.0,w:9.2,h:0.3,fill:{color:ACCENT,transparency:25}});
p7.addText('Pilot partnership → SDK co-brand → API partnership',{x:0.52,y:5.04,w:8.96,h:0.26,fontSize:13,color:CYAN,bold:true,margin:0});
foot(p7);

// 9 BUSINESS MODEL
const p8=pres.addSlide(); header(p8,'Business Model');
brandHeadline(p8,'Multi-revenue flywheel aligned with partners');
[
  ['Verification API','$0.001 / call after beta.\nScales with transaction volume.',CYAN,0.4],
  ['Merchant tiers','Bronze · Silver · Gold\nAnalytics, white-label, unified views.',PINK,3.52],
  ['$PAB token','Rewards + merchant rebates + dispute fees.',CYAN,6.64]
].forEach((c)=>{
  const x=c[3],y=1.66,w=2.92,h=1.26;
  p8.addShape(pres.shapes.RECTANGLE,{x,y,w,h,fill:{color:PANEL},shadow:mkShadow()});
  p8.addShape(pres.shapes.RECTANGLE,{x,y,w:0.12,h,fill:{color:c[2]}});
  p8.addText(c[0],{x:x+0.24,y:y+0.16,w:w-0.36,h:0.32,fontSize:15,fontFace:'Arial',color:c[2],bold:true,margin:0});
  p8.addText(c[1],{x:x+0.24,y:y+0.56,w:w-0.36,h:0.64,fontSize:13,color:WHITE,margin:0});
});
[
  ['Enterprise SLA','Dedicated instances for Shopify Plus / Daraz Pro.',PINK,0.4],
  ['Data insights','Anonymized aggregated reliability analytics.',PINK,3.52],
  ['Platform margins','Shared upside with Shopify / Daraz / Alibaba.',CYAN,6.64]
].forEach((c)=>{
  const x=c[3],y=3.1,w=2.92,h=1.0;
  p8.addShape(pres.shapes.RECTANGLE,{x,y,w,h,fill:{color:PANEL},shadow:mkShadow()});
  p8.addShape(pres.shapes.RECTANGLE,{x,y,w:0.12,h,fill:{color:c[2]}});
  p8.addText(c[0],{x:x+0.24,y:y+0.16,w:w-0.36,h:0.28,fontSize:14,fontFace:'Arial',color:c[2],bold:true,margin:0});
  p8.addText(c[1],{x:x+0.24,y:y+0.48,w:w-0.36,h:0.46,fontSize:13,color:WHITE,margin:0});
});
foot(p8);

// 10 TEAM
const p9=pres.addSlide(); header(p9,'Team & Advisors');
brandHeadline(p9,'US-based founder with Pakistan-market depth');
p9.addShape(pres.shapes.RECTANGLE,{x:0.4,y:1.66,w:2.24,h:2.4,fill:{color:PANEL},shadow:mkShadow()});
p9.addShape(pres.shapes.RECTANGLE,{x:0.4,y:1.66,w:2.24,h:0.12,fill:{color:PINK}});
p9.addText('JH',{x:0.4,y:1.8,w:2.24,h:1.18,fontSize:52,fontFace:'Arial',color:CYAN,bold:true,align:'center',valign:'middle',margin:0});
p9.addText('Jawad Hussain',{x:0.4,y:3.06,w:2.24,h:0.26,fontSize:13,fontFace:'Arial',color:WHITE,bold:true,align:'center',margin:0});
p9.addText('Founder & Engineer',{x:0.4,y:3.32,w:2.24,h:0.24,fontSize:12,color:MUTED,align:'center',margin:0});
const bullets=[
  'GitHub: jweezy119',
  'Twitter: @PabandiGlobal',
  'Full-stack: React/TS · Node/Express · Solana · AI/ML',
  'Hardened Cloud Run backend · Firebase + Prisma',
  'Solana token deployed · PabandiEscrow + Soulbound',
  'Docs, SDK, outreach assets published in repo',
  'Hiring: Pakistan BD lead + merchant onboarding manager'
];
p9.addText(bullets.map((t,i)=>({text:t,options:{bullet:true,breakLine:i!==bullets.length-1}})),{x:2.84,y:1.66,w:6.76,h:2.4,fontSize:13.5,color:WHITE,margin:0});
p9.addText('Advisors sought: Alibaba ecosystem + payments',{x:0.4,y:4.2,w:9.2,h:0.24,fontSize:13,color:CYAN,margin:0});
foot(p9);

// 11 ROADMAP
const p10=pres.addSlide(); header(p10,'Roadmap');
brandHeadline(p10,'Pakistan → Daraz → Global → AI Commerce');
[
  ['Now','Pakistan lab · Merchant API live\nWhatsApp automations · Merchants onboarding',0.4],
  ['+6m','Daraz pilot · Shopify launch\nEnterprise partnerships + advisor network',4.52],
  ['+12m','SEA + MENA expansion\n10k+ active merchants + 3 integrations',0.4],
  ['+24m','AI commerce agent layer\nAutonomous reliability checks + global SDK network',4.52]
].forEach((r)=>{
  const x=r[2],y=r[2]<3?1.66:3.38,w=3.9,h=1.36;
  p10.addShape(pres.shapes.RECTANGLE,{x,y,w,h,fill:{color:PANEL},shadow:mkShadow()});
  p10.addShape(pres.shapes.RECTANGLE,{x,y,w:0.12,h,fill:{color:PINK}});
  p10.addText(r[0],{x:x+0.18,y:y+0.14,w:r.w-0.32,h:0.28,fontSize:14,fontFace:'Arial',color:PINK,bold:true,margin:0});
  p10.addText(r[1],{x:x+0.18,y:y+0.48,w:r.w-0.32,h:0.82,fontSize:13,color:WHITE,margin:0});
});
foot(p10);

// 12 ASK
const p11=pres.addSlide(); p11.background={color:BG};
p11.addShape(pres.shapes.RECTANGLE,{x:0,y:1.02,w:W,h:1.98,fill:{color:PANEL,transparency:30}});
p11.addShape(pres.shapes.RECTANGLE,{x:0,y:1.02,w:0.68,h:1.98,fill:{color:CYAN}});
p11.addText('Why Pabandi → CoCreate winner',{x:0.86,y:1.1,w:8.6,h:0.32,fontSize:13,color:MUTED,margin:0});
p11.addText('Alibaba-ready trust layer for emerging-market commerce',{x:0.86,y:1.52,w:8.68,h:1.0,fontSize:34,fontFace:'Arial',color:WHITE,bold:true,margin:0,lineSpacingMultiple:1.08});
[{t:'Live pain',b:'COD losses in Daraz every day.\nPakistan pilots already built.',x:0.42,a:CYAN},
 {t:'Built to partner',b:'Scoped Daraz + Shopify integrations.\nFaster to partner than build.',x:2.98,a:PINK},
 {t:'Live infra',b:'Solana + Firebase + Prisma.\nSDK + docs ready to ship.',x:5.54,a:CYAN},
 {t:'Efficient scale',b:'Prove unit economics in 6 months.\nDistribute via Alibaba merchant network.',x:8.1,a:PINK}
].forEach(c=>{
  const x=c.x,y=3.18,w=2.32,h=1.22;
  p11.addShape(pres.shapes.RECTANGLE,{x,y,w,h,fill:{color:PANEL},shadow:mkShadow()});
  p11.addShape(pres.shapes.RECTANGLE,{x,y,w:0.12,h,fill:{color:c.a}});
  p11.addText(c.t,{x:x+0.18,y:y+0.18,w:2.2,h:0.28,fontSize:13,fontFace:'Arial',color:c.a,bold:true,margin:0});
  p11.addText(c.b,{x:x+0.18,y:y+0.54,w:2.04,h:0.62,fontSize:12.5,color:WHITE,margin:0});
});
p11.addShape(pres.shapes.RECTANGLE,{x:0.38,y:5.08,w:9.24,h:0.3,fill:{color:ACCENT,transparency:25}});
p11.addText('Ask: Alibaba pilot · SDK co-brand · API partnership · investment partner',{x:0.52,y:5.12,w:8.96,h:0.24,fontSize:13,color:WHITE,bold:true,margin:0});
p11.addShape(pres.shapes.RECTANGLE,{x:0,y:5.4,w:W,h:0.12,fill:{color:PINK}});

const outPath = path.join(repoDir, 'Pabandi-Alibaba-CoCreate-2026.pptx');
pres.writeFile({fileName: outPath}).then(()=>console.log(`WROTE ${outPath}`)).catch(e=>{console.error('ERR',e);process.exit(1)});
