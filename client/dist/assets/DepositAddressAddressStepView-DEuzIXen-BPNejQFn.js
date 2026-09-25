import{da as u,dc as e,dd as t,dn as E}from"./index-DMgB8B-w.js";import{m as S,g as v,p as b,f as j,v as w,a as D,u as g,h as x,b as y,t as I}from"./styles-BSL8-rdX-Bsdoqlw9.js";import{n as U}from"./ScreenLayout-XFsWudNK-CpWvBU0O.js";import{b as F}from"./ModalFooter-BldNwiHO-DEBKMbgd.js";import{x as O}from"./QrCode-cA9rnMIN-DdFklOKJ.js";import{u as R,a as A,s as z,b as L,c as M,d as P,e as $,f as B,g as q,F as W}from"./floating-ui.react-Npigeph1.js";import{p as H}from"./CopyableText-CQapvaMr-DFgH5YNm.js";import{H as V}from"./hourglass-C8SVBuN1.js";import{C as T}from"./check-DQ_MnRfH.js";import{c as C}from"./createLucideIcon-Cr3FycHC.js";import{C as Y}from"./chevron-down-C7_vouoy.js";import{T as K}from"./triangle-alert-C--EEv67.js";import{n as Q,o as X,p as G,s as J}from"./floating-ui.react-dom-BmL3glbW.js";/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Z=[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]],ee=C("chevron-up",Z);/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const re=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 16v-4",key:"1dtifu"}],["path",{d:"M12 8h.01",key:"e9boi3"}]],ne=C("info",re);/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oe=[["rect",{width:"5",height:"5",x:"3",y:"3",rx:"1",key:"1tu5fj"}],["rect",{width:"5",height:"5",x:"16",y:"3",rx:"1",key:"1v8r4q"}],["rect",{width:"5",height:"5",x:"3",y:"16",rx:"1",key:"1x03jg"}],["path",{d:"M21 16h-3a2 2 0 0 0-2 2v3",key:"177gqh"}],["path",{d:"M21 21v.01",key:"ents32"}],["path",{d:"M12 7v3a2 2 0 0 1-2 2H7",key:"8crl2c"}],["path",{d:"M3 12h.01",key:"nlz23k"}],["path",{d:"M12 3h.01",key:"n36tog"}],["path",{d:"M12 16v.01",key:"133mhm"}],["path",{d:"M16 12h1",key:"1slzba"}],["path",{d:"M21 12v.01",key:"1lwtk9"}],["path",{d:"M12 21v-1",key:"1880an"}]],ie=C("qr-code",oe);class Ye extends u.Component{static getDerivedStateFromError(){return{hasError:!0}}componentDidCatch(o,n){this.props.onError(o)}componentDidUpdate(o){o.resetKey!==this.props.resetKey&&this.state.hasError&&this.setState({hasError:!1})}render(){return this.state.hasError?null:this.props.children}constructor(...o){super(...o),this.state={hasError:!1}}}function te(r,o,n){let i=Number(r);return!Number.isFinite(i)||i===0?`1 ${o} ≈ ${r} ${n}`:i>=.01?`1 ${o} ≈ ${_(i)} ${n}`:`${_(1/i)} ${o} ≈ 1 ${n}`}function _(r){return r>=1e3?new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(Math.round(r)):r>=100?new Intl.NumberFormat("en-US",{maximumFractionDigits:1}).format(r):r>=1?new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(r):new Intl.NumberFormat("en-US",{maximumFractionDigits:4}).format(r)}function Ke(r,o){let n=Number(r);if(!Number.isFinite(n)||n===0)return r;let i=o!=null?n/10**o:n;return i>=1e3?new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(i):i>=1?new Intl.NumberFormat("en-US",{maximumFractionDigits:4}).format(i):i>=1e-4?new Intl.NumberFormat("en-US",{maximumFractionDigits:6}).format(i):new Intl.NumberFormat("en-US",{maximumSignificantDigits:4}).format(i)}function Qe({address:r,caip2:o,config:n}){for(let i of n.currencies){let a=i.chains.find(s=>s.caip2===o&&s.address.toLowerCase()===r.toLowerCase());if(a)return{symbol:i.symbol.toUpperCase(),decimals:a.decimals}}return{symbol:r,decimals:void 0}}function Xe(r,o){let n=o[r];return(n==null?void 0:n.displayName)??(n==null?void 0:n.display_name)??r}function Ge(r,o){return r.chains.filter(n=>n.can_be_relay_deposit_source===!0).map(n=>{let i=o.chains[n.caip2];return i?{caip2:n.caip2,displayName:i.displayName,iconUrl:i.iconUrl,vmType:i.vmType,currencyAddress:n.address,currencyDecimals:n.decimals}:null}).filter(n=>n!==null)}function Je(r,o){if(!r.chains[o.destinationChain])return`Unsupported destination chain: "${o.destinationChain}". Check that the chain is in CAIP-2 format (e.g. "eip155:8453") and is supported for deposit addresses.`;let n=o.destinationCurrency.toLowerCase();return r.currencies.some(i=>i.chains.some(a=>a.caip2===o.destinationChain&&a.address.toLowerCase()===n))?null:`Unsupported destination currency "${o.destinationCurrency}" on chain "${o.destinationChain}". Check that this token address is supported on the specified chain.`}let se=new Set(["ROUTE_UNAVAILABLE","UNEXPECTED_STATE","TIMEOUT_WAITING_FOR_NEXT_ORDER","TIMEOUT_ORDER_COMPLETION","DEPOSIT_FAILED","DEPOSIT_REFUNDED","USER_EXITED","AMOUNT_TOO_LOW","INSUFFICIENT_LIQUIDITY","UNSUPPORTED_CHAIN","UNSUPPORTED_CURRENCY","UNSUPPORTED_ROUTE","NO_SWAP_ROUTES_FOUND","NO_INTERNAL_SWAP_ROUTES_FOUND","NO_QUOTES","SANCTIONED_WALLET_ADDRESS","REFUND_WALLET_CREATION_FAILED","DEPOSIT_ADDRESSES_NOT_ENABLED","NOT_AUTHENTICATED"]);function ae(r){return se.has(r)}function Ze(r){return ae(r)?r:"UNKNOWN_ERROR"}const er=({trackingUrl:r,onViewBlockExplorer:o,onClose:n})=>{let i=r&&o?()=>{o(),window.open(r,"_blank","noopener,noreferrer")}:void 0;return e.jsx(U,{icon:V,iconVariant:"subtle",title:"Transfer in progress",subtitle:"Your deposit was received and the transfer is now processing.",showClose:!0,onClose:n,secondaryCta:i?{label:"View on block explorer ↗",onClick:i}:void 0,watermark:!1,children:e.jsxs(S,{children:[e.jsxs(v,{children:[e.jsx(b,{$status:"done",children:e.jsx(T,{size:14,color:"var(--privy-color-icon-success)",strokeWidth:2})}),e.jsx(j,{children:"Deposit received"})]}),e.jsx(w,{}),e.jsxs(v,{children:[e.jsx(b,{$status:"active",children:e.jsx(de,{})}),e.jsx(j,{children:"Bridging"})]}),e.jsx(w,{}),e.jsxs(v,{children:[e.jsx(b,{$status:"pending"}),e.jsx(j,{children:"Funds arrived"})]})]})})};let de=t.span`
  width: 0.75rem;
  height: 0.75rem;
  border: 2px solid var(--privy-color-foreground-3);
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;function le({address:r,onClick:o}){let[n,i]=u.useState(!1);return e.jsx(e.Fragment,{children:n?e.jsx(ce,{onClick:()=>i(!1),style:{marginTop:"1.5rem"},children:e.jsx(O,{url:r,size:312,hideLogo:!0})}):e.jsxs(me,{title:"Click to copy address",onClick:o,style:{marginTop:"1.5rem"},children:[e.jsxs(ue,{children:[e.jsx(pe,{children:"Deposit address"}),e.jsx(he,{children:r})]}),e.jsx(fe,{children:e.jsx(ge,{type:"button",onClick:a=>{a.stopPropagation(),i(!0)},children:e.jsx(ie,{size:16,color:"var(--privy-color-icon-muted)"})})})]})})}let ce=t.div`
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  overflow: hidden;
`,me=t.div`
  display: flex;
  border-radius: var(--privy-border-radius-md);
  background: var(--privy-color-background-clicked);
  padding: 1rem;
  cursor: pointer;
  gap: 0.5rem;
`,ue=t.div`
  flex: 1;
  min-width: 0;
  text-align: left;
`,pe=t.div`
  font-size: 0.75rem;
  color: var(--privy-color-icon-muted);
  line-height: 1rem;
  margin-bottom: 0.25rem;
`,he=t.div`
  word-break: break-all;
  font-size: 0.875rem;
  font-family: ui-monospace, monospace;
  font-weight: 500;
  line-height: 1.375rem;
  color: var(--privy-color-foreground);
`,fe=t.div`
  width: 1.5rem;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding-top: 0.25rem;
`,ge=t.button`
  && {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border: none;
    background: transparent;
    cursor: pointer;
    outline: none;
    box-shadow: none;
    border-radius: var(--privy-border-radius-xs);

    &:hover {
      background: var(--privy-color-background);
    }

    &:focus,
    &:focus-visible {
      outline: none;
      box-shadow: none;
    }
  }
`,N=r=>/^0x/i.test(r)||r.length>16;function xe({quote:r,selectedCurrency:o,selectedChain:n,destinationSymbol:i,destinationChainName:a,destinationAsset:s}){let[p,h]=u.useState(!1),d=o.symbol.toUpperCase(),l=n.displayName,c=u.useRef(null);return e.jsxs(ye,{children:[e.jsxs(ve,{onClick:u.useCallback(()=>{let m=document.getElementById("privy-modal-content");m&&(c.current&&clearTimeout(c.current),m.style.transition="none",c.current=setTimeout(()=>{m.style.transition="",c.current=null},160)),h(f=>!f)},[]),children:[e.jsxs(be,{children:[o.logoURI&&e.jsx(D,{src:o.logoURI,alt:d,style:{width:"2rem",height:"2rem"}}),n.iconUrl&&e.jsx(je,{src:n.iconUrl,alt:l})]}),e.jsxs(Ce,{children:[e.jsx(ke,{children:"You send"}),e.jsxs(Ee,{children:[d," on ",l]})]}),e.jsx(we,{children:e.jsx(p?ee:Y,{size:16})})]}),e.jsx(Te,{$expanded:p,children:e.jsx(Se,{children:e.jsxs(_e,{children:[r.indicative_rate&&e.jsxs(g,{children:[e.jsx(x,{children:"Conversion rate"}),e.jsxs(y,{style:{display:"flex",alignItems:"center",gap:"0.25rem"},children:[te(r.indicative_rate,d,i.toUpperCase()),e.jsx(De,{content:"Estimated rate based on current market conditions. Final execution price may vary depending on transfer size and routing."})]})]}),e.jsxs(g,{children:[e.jsx(x,{children:"Receive"}),e.jsxs(y,{children:[i&&!N(i)?i.toUpperCase():N(s)?E(s):s.toUpperCase(),a?` on ${a}`:""]})]}),r.slippage_bps!=null&&e.jsxs(g,{children:[e.jsx(x,{children:"Max slippage"}),e.jsxs(y,{children:[(r.slippage_bps/100).toFixed(1),"%"]})]}),r.refund_address&&e.jsxs(g,{children:[e.jsx(x,{children:"Refund address"}),e.jsx(y,{children:e.jsx(H,{value:r.refund_address,iconOnly:!0,iconSize:11,children:E(r.refund_address,4,4)})})]})]})})}),e.jsxs(Ne,{children:[e.jsx(K,{size:16,color:"var(--privy-color-icon-muted)",style:{flexShrink:0}}),e.jsxs(Ue,{children:["Only send ",e.jsx("strong",{children:d})," on ",e.jsx("strong",{children:l}),". Other assets may be lost."]})]})]})}let ye=t.div`
  border-radius: var(--privy-border-radius-md);
  border: 1px solid var(--privy-color-foreground-4);
  overflow: hidden;
`,ve=t.button`
  && {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--privy-color-foreground);
    outline: none;
    box-shadow: none;

    &:focus,
    &:focus-visible {
      outline: none;
      box-shadow: none;
    }
  }
`,be=t.span`
  position: relative;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
`,je=t(I)`
  && {
    position: absolute;
    top: -0.125rem;
    right: -0.25rem;
    width: 0.75rem;
    height: 0.75rem;
    box-sizing: content-box;
    border: 1.5px solid var(--privy-color-background);
    background-color: var(--privy-color-background);
  }
`,Ce=t.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`,ke=t.span`
  font-size: 0.75rem;
  color: var(--privy-color-foreground-3);
  line-height: 1rem;
`,Ee=t.span`
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25rem;
`,we=t.span`
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--privy-border-radius-full);
  background-color: var(--privy-color-background-clicked);
  color: var(--privy-color-foreground-3);
`,_e=t.div`
  display: flex;
  flex-direction: column;
  padding: 0 1rem 0.75rem;

  & > * {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--privy-color-foreground-4);
  }

  & > *:last-child {
    border-bottom: none;
  }
`,Ne=t.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0.75rem 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--privy-border-radius-sm);
  background: var(--privy-color-background-2);
`,Ue=t.span`
  font-size: 0.8125rem;
  line-height: 1.25rem;
  color: var(--privy-color-icon-muted);
  text-align: left;
`,Te=t.div`
  display: grid;
  grid-template-rows: ${({$expanded:r})=>r?"1fr":"0fr"};
  transition: grid-template-rows 150ms ease-out;
`,Se=t.div`
  overflow: hidden;
`;function De({content:r}){let[o,n]=u.useState(!1),{refs:i,floatingStyles:a,context:s}=R({open:o,onOpenChange:n,placement:"top",whileElementsMounted:Q,middleware:[X(6),G(),J({padding:8})]}),p=A(s,{move:!1,handleClose:z()}),h=L(s),{getReferenceProps:d,getFloatingProps:l}=M([p,h,P(s),$(s),B(s,{role:"tooltip"})]),{isMounted:c,styles:m}=q(s,{duration:150});return e.jsxs(e.Fragment,{children:[e.jsx("button",{ref:i.setReference,type:"button","aria-label":"More information about conversion rate",style:{display:"inline-flex",alignItems:"center",justifyContent:"center",padding:0,border:"none",background:"none",color:"var(--privy-color-icon-muted)",cursor:"pointer"},...d(),children:e.jsx(ne,{size:14})}),c&&e.jsx(W,{root:document.getElementById("privy-modal-content")??void 0,children:e.jsx(Ie,{ref:i.setFloating,style:{...a,...m},...l(),children:r})})]})}let Ie=t.div`
  max-width: 13rem;
  padding: 0.5rem 0.625rem;
  border-radius: var(--privy-border-radius-sm, 0.375rem);
  background: var(--privy-color-foreground);
  color: var(--privy-color-background);
  font-size: 0.6875rem;
  line-height: 1rem;
  font-weight: 400;
  text-align: left;
  z-index: 10;
`;const rr=({quote:r,selectedCurrency:o,selectedChain:n,destinationSymbol:i,destinationChainName:a,destinationAsset:s,onBack:p,onClose:h})=>{var k;let[d,l]=u.useState(!1),c=((k=o==null?void 0:o.symbol)==null?void 0:k.toUpperCase())??"funds",m=(n==null?void 0:n.displayName)??"",f=async()=>{d||(await navigator.clipboard.writeText(r.deposit_address),l(!0),setTimeout(()=>l(!1),2e3))};return e.jsxs(U,{title:`Send ${c}${m?` on ${m}`:""}`,subtitle:"Send funds to the address below. Conversion and routing handled by Relay.",showBack:!0,onBack:p,showClose:!0,onClose:h,watermark:!1,children:[e.jsx(xe,{quote:r,selectedCurrency:o,selectedChain:n,destinationSymbol:i,destinationChainName:a,destinationAsset:s}),e.jsx(le,{address:r.deposit_address,onClick:f}),e.jsx(F,{style:{marginTop:"1rem",marginBottom:"0.5rem",...d?{backgroundColor:"var(--privy-color-icon-success)",borderColor:"var(--privy-color-icon-success)"}:{}},onClick:f,children:d?e.jsxs(e.Fragment,{children:["Copied ",e.jsx(T,{size:16,style:{marginLeft:"0.25rem"}})]}):"Copy address"}),e.jsx(Fe,{children:"Routing and bridging are handled by Relay. Privy does not control execution timing, liquidity, or transaction outcomes."})]})};let Fe=t.p`
  && {
    margin: 0.5rem 0 0;
    font-size: 0.6875rem;
    line-height: 1.125rem;
    color: var(--privy-color-icon-muted);
    text-align: center;
  }
`;export{Je as G,Qe as H,Xe as K,Ye as Q,rr as T,Ge as X,Ke as Y,ie as a,Ze as e,er as r};
