import{da as a,dH as T,de as _,d8 as E,dc as e,eL as I,eW as W,eX as U,e3 as F,dd as p,ef as H}from"./index-DMgB8B-w.js";import{b as N}from"./ModalFooter-BldNwiHO-DEBKMbgd.js";import{l as V}from"./Layouts-BMRfo5hw-DUEqUByN.js";import{g as B,h as L,y as M,w as O,k as q}from"./shared-C4KM7VSO-BIqnIIf9.js";import{w as t}from"./Screen-Dtn4lspb-BaR3uc9-.js";import"./index-CWARkn2w-Dlag2Bbu.js";const ee={component:()=>{let[o,y]=a.useState(!0),{authenticated:v,user:b}=T(),{walletProxy:i,closePrivyModal:m,createAnalyticsEvent:x,client:j}=_(),{navigate:k,data:A,onUserCloseViaDialogOrKeybindRef:C}=E(),[n,S]=a.useState(void 0),[f,d]=a.useState(""),[c,w]=a.useState(!1),{entropyId:u,entropyIdVerifier:$,onCompleteNavigateTo:g,onSuccess:h,onFailure:P}=A.recoverWallet,l=(r="User exited before their wallet could be recovered")=>{m({shouldCallAuthOnSuccess:!1}),P(typeof r=="string"?new F(r):r)};return C.current=l,a.useEffect(()=>{if(!v)return l("User must be authenticated and have a Privy wallet before it can be recovered")},[v]),e.jsxs(t,{children:[e.jsx(t.Header,{icon:I,title:"Enter your password",subtitle:"Please provision your account on this new device. To continue, enter your recovery password.",showClose:!0,onClose:l}),e.jsx(t.Body,{children:e.jsx(z,{children:e.jsxs("div",{children:[e.jsxs(B,{children:[e.jsx(L,{type:o?"password":"text",onChange:r=>(s=>{s&&S(s)})(r.target.value),disabled:c,style:{paddingRight:"2.3rem"}}),e.jsx(M,{style:{right:"0.75rem"},children:o?e.jsx(O,{onClick:()=>y(!1)}):e.jsx(q,{onClick:()=>y(!0)})})]}),!!f&&e.jsx(D,{children:f})]})})}),e.jsxs(t.Footer,{children:[e.jsx(t.HelpText,{children:e.jsxs(V,{children:[e.jsx("h4",{children:"Why is this necessary?"}),e.jsx("p",{children:"You previously set a password for this wallet. This helps ensure only you can access it"})]})}),e.jsx(t.Actions,{children:e.jsx(K,{loading:c||!i,disabled:!n,onClick:async()=>{w(!0);let r=await j.getAccessToken(),s=W(b,u);if(!r||!s||n===null)return l("User must be authenticated and have a Privy wallet before it can be recovered");try{x({eventName:"embedded_wallet_recovery_started",payload:{walletAddress:s.address}}),await(i==null?void 0:i.recover({accessToken:r,entropyId:u,entropyIdVerifier:$,recoveryPassword:n})),d(""),g?k(g):m({shouldCallAuthOnSuccess:!1}),h==null||h(s),x({eventName:"embedded_wallet_recovery_completed",payload:{walletAddress:s.address}})}catch(R){U(R)?d("Invalid recovery password, please try again."):d("An error has occurred, please try again.")}finally{w(!1)}},$hideAnimations:!u&&c,children:"Recover your account"})}),e.jsx(t.Watermark,{})]})]})}};let z=p.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`,D=p.div`
  line-height: 20px;
  height: 20px;
  font-size: 13px;
  color: var(--privy-color-error);
  text-align: left;
  margin-top: 0.5rem;
`,K=p(N)`
  ${({$hideAnimations:o})=>o&&H`
      && {
        /* Remove animations because the recoverWallet task on the iframe partially
           blocks the renderer, so the animation stutters and doesn't look good */
        transition: none;
      }
    `}
`;export{ee as PasswordRecoveryScreen,ee as default};
