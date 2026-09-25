import{dd as n,dH as I,fB as L,de as N,d8 as A,da as m,dc as e,dg as C,dh as g,ef as P,fC as S}from"./index-DMgB8B-w.js";import{a as M,c as v}from"./TodoList-DnyULl18-BVaKK2ec.js";import{n as j}from"./ScreenLayout-XFsWudNK-CpWvBU0O.js";import{C as B}from"./circle-check-big-DEf6jgoJ.js";import{F as b}from"./fingerprint-pattern-CEdn2yAt.js";import{c as z}from"./createLucideIcon-Cr3FycHC.js";import"./x-CsyxLEr0.js";import"./check-DQ_MnRfH.js";import"./ModalFooter-BldNwiHO-DEBKMbgd.js";import"./Screen-Dtn4lspb-BaR3uc9-.js";import"./index-CWARkn2w-Dlag2Bbu.js";/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const U=[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],W=z("trash-2",U),T=({passkeys:i,name:l,isLoading:u,errorReason:y,success:o,expanded:a,onLinkPasskey:f,onUnlinkPasskey:t,onExpand:r,onBack:s,onClose:d})=>o?e.jsx(j,{title:"Passkeys updated",icon:B,iconVariant:"success",primaryCta:{label:"Done",onClick:d},onClose:d,watermark:!0}):a?e.jsx(j,{icon:b,title:"Your passkeys",onBack:s,onClose:d,watermark:!0,children:e.jsx(E,{passkeys:i,expanded:a,onUnlink:t,onExpand:r})}):e.jsxs(j,{icon:b,title:"Set up passkey verification",subtitle:"Verify with passkey",primaryCta:{label:"Add new passkey",onClick:f,loading:u},onClose:d,watermark:!0,helpText:y||void 0,children:[i.length===0?e.jsx(O,{}):e.jsx(_,{children:e.jsx(E,{passkeys:i,expanded:a,onUnlink:t,onExpand:r})}),l?e.jsxs($,{children:[e.jsx(V,{children:"New Passkey Name"}),e.jsx(D,{children:l})]}):null]});let _=n.div`
  margin-bottom: 0.75rem;
`,$=n.div`
  margin-top: 0.25rem;
`,V=n.div`
  color: var(--privy-color-foreground-2);
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1rem;
  margin-bottom: 0.25rem;
`,D=n.div`
  color: var(--privy-color-foreground);
  font-size: 0.875rem;
  line-height: 1.25rem;
`,E=({passkeys:i,expanded:l,onUnlink:u,onExpand:y})=>{let[o,a]=m.useState([]),f=l?i.length:2;return e.jsxs("div",{children:[e.jsx(H,{children:"Your passkeys"}),e.jsxs(Y,{children:[i.slice(0,f).map(t=>{var s;return e.jsxs(G,{children:[e.jsxs("div",{children:[e.jsx(K,{children:(r=t,r.authenticatorName?r.createdWithBrowser?`${r.authenticatorName} on ${r.createdWithBrowser}`:r.authenticatorName:r.createdWithBrowser?r.createdWithOs?`${r.createdWithBrowser} on ${r.createdWithOs}`:`${r.createdWithBrowser}`:"Unknown device")}),e.jsxs(q,{children:["Last used:"," ",((s=t.latestVerifiedAt??t.firstVerifiedAt)==null?void 0:s.toLocaleString())??"N/A"]})]}),e.jsx(Q,{disabled:o.includes(t.credentialId),onClick:()=>(async d=>{a(c=>c.concat([d])),await u(d),a(c=>c.filter(x=>x!==d))})(t.credentialId),children:o.includes(t.credentialId)?e.jsx(S,{}):e.jsx(W,{size:16})})]},t.credentialId);var r}),i.length>2&&!l&&e.jsx(R,{onClick:y,children:"View all"})]})]})},O=()=>e.jsxs(M,{style:{color:"var(--privy-color-foreground)"},children:[e.jsx(v,{children:"Verify with Touch ID, Face ID, PIN, or hardware key"}),e.jsx(v,{children:"Takes seconds to set up and use"}),e.jsx(v,{children:"Use your passkey to verify transactions and login to your account"})]});const le={component:()=>{var w;let{user:i}=I(),{unlink:l}=L(),{linkWithPasskey:u,closePrivyModal:y}=N(),{data:o}=A(),a=i==null?void 0:i.linkedAccounts.filter(p=>p.type==="passkey"),[f,t]=m.useState(!1),[r,s]=m.useState(""),[d,c]=m.useState(!1),[x,k]=m.useState(!1);return m.useEffect(()=>{a.length===0&&k(!1)},[a.length]),e.jsx(T,{passkeys:a,name:(w=o==null?void 0:o.passkeyAuthModalData)==null?void 0:w.name,isLoading:f,errorReason:r,success:d,expanded:x,onLinkPasskey:()=>{var p;t(!0),u({name:(p=o==null?void 0:o.passkeyAuthModalData)==null?void 0:p.name}).then(()=>c(!0)).catch(h=>{if(h instanceof C){if(h.privyErrorCode===g.CANNOT_LINK_MORE_OF_TYPE)return void s("Cannot link more passkeys to account.");if(h.privyErrorCode===g.PASSKEY_NOT_ALLOWED)return void s("Passkey request timed out or rejected by user.")}s("Unknown error occurred.")}).finally(()=>{t(!1)})},onUnlinkPasskey:async p=>(t(!0),await l({credentialId:p}).then(()=>c(!0)).catch(h=>{h instanceof C&&h.privyErrorCode===g.MISSING_MFA_CREDENTIALS?s("Cannot unlink a passkey enrolled in MFA"):s("Unknown error occurred.")}).finally(()=>{t(!1)})),onExpand:()=>k(!0),onBack:()=>k(!1),onClose:()=>y()})}},ce=n.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 180px;
  height: 90px;
  border-radius: 50%;
  svg + svg {
    margin-left: 12px;
  }
  > svg {
    z-index: 2;
    color: var(--privy-color-accent) !important;
    stroke: var(--privy-color-accent) !important;
    fill: var(--privy-color-accent) !important;
  }
`;let F=P`
  && {
    width: 100%;
    font-size: 0.875rem;
    line-height: 1rem;

    /* Tablet and Up */
    @media (min-width: 440px) {
      font-size: 14px;
    }

    display: flex;
    gap: 12px;
    justify-content: center;

    padding: 6px 8px;
    background-color: var(--privy-color-background);
    transition: background-color 200ms ease;
    color: var(--privy-color-accent) !important;

    :focus {
      outline: none;
      box-shadow: none;
    }
  }
`;const R=n.button`
  ${F}
`;let Y=n.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.8rem;
  padding: 0.5rem 0 0;
  flex-grow: 1;
  width: 100%;
`,H=n.div`
  line-height: 20px;
  height: 20px;
  font-size: 1em;
  font-weight: 450;
  display: flex;
  justify-content: flex-start;
  width: 100%;
`,K=n.div`
  font-size: 1em;
  line-height: 1.3em;
  font-weight: 500;
  color: var(--privy-color-foreground-2);
  padding: 0.2em 0;
`,q=n.div`
  font-size: 0.875rem;
  line-height: 1rem;
  color: var(--privy-color-foreground-2);
  padding: 0.2em 0;
`,G=n.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1em;
  gap: 10px;
  font-size: 0.875rem;
  line-height: 1rem;
  text-align: left;
  border-radius: 8px;
  border: 1px solid var(--privy-color-border-default) !important;
  width: 100%;
  height: 5em;
`,J=P`
  :focus,
  :hover,
  :active {
    outline: none;
  }
  display: flex;
  width: 2em;
  height: 2em;
  justify-content: center;
  align-items: center;
  svg {
    color: var(--privy-color-error);
  }
  svg:hover {
    color: var(--privy-color-foreground-3);
  }
`,Q=n.button`
  ${J}
`;export{ce as DoubleIconWrapper,R as LinkButton,le as LinkPasskeyScreen,T as LinkPasskeyView,le as default};
