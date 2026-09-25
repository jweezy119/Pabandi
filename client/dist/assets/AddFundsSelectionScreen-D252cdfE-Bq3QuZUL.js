import{d7 as k,d8 as A,d9 as L,da as s,db as F,dc as e,dd as p}from"./index-DMgB8B-w.js";import{n as G}from"./index-CWARkn2w-Dlag2Bbu.js";import{h as O,t as _}from"./GooglePay-B53WnudL-BUYYueHM.js";import{a as w,o as R,p as D}from"./isPaymentRequestAvailable-Bq1cemEn-DMvajXC8.js";import{n as T}from"./styles-DVyDvTdj-Bevh6sCb.js";import{i as P,l,s as a}from"./styles-BSL8-rdX-Bsdoqlw9.js";import{C as Y,L as S}from"./landmark-CkXpbdZY.js";import{W as z}from"./wallet-BOTy_bdc.js";import"./ScreenLayout-XFsWudNK-CpWvBU0O.js";import"./ModalFooter-BldNwiHO-DEBKMbgd.js";import"./Screen-Dtn4lspb-BaR3uc9-.js";import"./createLucideIcon-Cr3FycHC.js";const X={component:()=>{let r=k(),{onUserCloseViaDialogOrKeybindRef:h}=A(),v=L(),i=s.useRef(!1),u=w(R),y=w(D),[E,b]=s.useState(!1),x=u?"APPLE_PAY":u===!1&&y?"GOOGLE_PAY":null,f=u===!0||u===!1&&y!==void 0,j=!(r!=null&&r.startFiat)||f||E;s.useEffect(()=>{let t=window.setTimeout(()=>b(!0),2e3);return()=>window.clearTimeout(t)},[]),s.useEffect(()=>{r&&(i.current=!1)},[r]);let C=s.useRef(null);s.useEffect(()=>{var t;r&&!r.error&&j&&C.current!==r&&(C.current=r,(t=r.recordRowsViewed)==null||t.call(r,{walletPay:r.startFiat?x:void 0,walletPayTimedOut:r.startFiat?!f:void 0}))},[j,r,x,f]);let n=s.useCallback(async()=>{!i.current&&r&&(i.current=!0,F(),await r.onCancel())},[r]);if(s.useEffect(()=>(h.current=n,()=>{h.current===n&&(h.current=null)}),[n,h]),!r)return null;if(r.error)return e.jsx(P,{title:"Unable to add funds",subtitle:r.error,showClose:!0,onClose:n,primaryCta:{label:"Close",onClick:n}});let m=async t=>{var g;i.current||(i.current=!0,await((g=r.startFiat)==null?void 0:g.call(r,t)))};return e.jsx(P,{title:"Pay with",subtitle:"Debit cards typically have higher success rates than credit cards, even with Apple Pay or Google Pay.",showClose:!0,onClose:n,children:j?e.jsxs(T,{style:{marginTop:"1rem"},$colorScheme:v.appearance.palette.colorScheme,children:[r.startFiat&&e.jsxs(l,{onClick:()=>m("CREDIT_DEBIT_CARD"),children:[e.jsx(o,{children:e.jsx(Y,{})}),e.jsxs(c,{children:[e.jsx(a,{children:"Debit or credit card"}),e.jsx(d,{children:"Less than 10 minutes"})]})]}),r.startFiat&&x==="APPLE_PAY"&&e.jsxs(l,{onClick:()=>m("APPLE_PAY"),children:[e.jsx(o,{children:e.jsx(O,{width:18,height:18})}),e.jsxs(c,{children:[e.jsx(a,{children:"Apple Pay"}),e.jsx(d,{children:"Less than 10 minutes"})]})]}),r.startFiat&&x==="GOOGLE_PAY"&&e.jsxs(l,{onClick:()=>m("GOOGLE_PAY"),children:[e.jsx(o,{children:e.jsx(_,{width:18,height:18})}),e.jsxs(c,{children:[e.jsx(a,{children:"Google Pay"}),e.jsx(d,{children:"Less than 10 minutes"})]})]}),r.startFiat&&e.jsxs(l,{onClick:()=>m("BANK"),children:[e.jsx(o,{children:e.jsx(S,{})}),e.jsxs(c,{children:[e.jsx(a,{children:"Bank account"}),e.jsx(d,{children:"1–2 days"})]})]}),r.startCrypto&&e.jsxs(l,{onClick:async()=>{var t;i.current||(i.current=!0,await((t=r.startCrypto)==null?void 0:t.call(r)))},children:[e.jsx(o,{children:e.jsx(z,{})}),e.jsxs(c,{children:[e.jsx(a,{children:"Crypto wallet or exchange"}),e.jsx(d,{children:"Instant"})]})]})]}):e.jsx(I,{children:e.jsx(G,{size:"50px"})})})}};let I=p.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 1rem;
  min-height: 8rem;
`,o=p.span`
  width: 2rem;
  height: 2rem;
  border-radius: var(--privy-border-radius-full);
  background-color: var(--privy-color-background-2);
  color: var(--privy-color-icon-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;

  svg {
    width: 1.125rem;
    height: 1.125rem;
  }
`,c=p.span`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`,d=p.span`
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: var(--privy-color-foreground-3);
`;export{X as AddFundsSelectionScreen,X as default};
