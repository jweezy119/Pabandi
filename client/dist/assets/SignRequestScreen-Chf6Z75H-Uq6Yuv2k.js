import{dH as M,de as k,d8 as N,da as r,f$ as z,dM as E,f4 as C,f5 as T,dc as a,dD as I,dd as p,ck as O,ch as q,g0 as P}from"./index-DMgB8B-w.js";import{h as F}from"./CopyToClipboard-i_OQSBJr-DN3shWIG.js";import{d as $}from"./Layouts-BMRfo5hw-DUEqUByN.js";import{a as H,i as V}from"./JsonTree-BHzNC-ic-C6F9W1vC.js";import{n as B}from"./ScreenLayout-XFsWudNK-CpWvBU0O.js";import{c as J}from"./createLucideIcon-Cr3FycHC.js";import"./ModalFooter-BldNwiHO-DEBKMbgd.js";import"./Screen-Dtn4lspb-BaR3uc9-.js";import"./index-CWARkn2w-Dlag2Bbu.js";/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const K=[["path",{d:"M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",key:"1m0v6g"}],["path",{d:"M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z",key:"ohrbg2"}]],Q=J("square-pen",K),U=p.img`
  && {
    height: ${e=>e.size==="sm"?"65px":"140px"};
    width: ${e=>e.size==="sm"?"65px":"140px"};
    border-radius: 16px;
    margin-bottom: 12px;
  }
`;let W=e=>{if(!O(e))return e;try{let s=q(e);return s.includes("�")?e:s}catch{return e}},G=e=>{try{let s=P.decode(e),i=new TextDecoder().decode(s);return i.includes("�")?e:i}catch{return e}},X=e=>{let{types:s,primaryType:i,...l}=e.typedData;return a.jsxs(a.Fragment,{children:[a.jsx(te,{data:l}),a.jsx(F,{text:(o=e.typedData,JSON.stringify(o,null,2)),itemName:"full payload to clipboard"})," "]});var o};const Y=({method:e,messageData:s,copy:i,iconUrl:l,isLoading:o,success:g,walletProxyIsLoading:m,errorMessage:x,isCancellable:d,onSign:c,onCancel:y,onClose:u})=>a.jsx(B,{title:i.title,subtitle:i.description,showClose:!0,onClose:u,icon:Q,iconVariant:"subtle",helpText:x?a.jsx(ee,{children:x}):void 0,primaryCta:{label:i.buttonText,onClick:c,disabled:o||g||m,loading:o},secondaryCta:d?{label:"Not now",onClick:y,disabled:o||g||m}:void 0,watermark:!0,children:a.jsxs($,{children:[l?a.jsx(U,{style:{alignSelf:"center"},size:"sm",src:l,alt:"app image"}):null,a.jsxs(Z,{children:[e==="personal_sign"&&a.jsx(w,{children:W(s)}),e==="eth_signTypedData_v4"&&a.jsx(X,{typedData:s}),e==="solana_signMessage"&&a.jsx(w,{children:G(s)})]})]})}),ue={component:()=>{let{authenticated:e}=M(),{initializeWalletProxy:s,closePrivyModal:i}=k(),{navigate:l,data:o,onUserCloseViaDialogOrKeybindRef:g}=N(),[m,x]=r.useState(!0),[d,c]=r.useState(""),[y,u]=r.useState(),[f,b]=r.useState(null),[R,S]=r.useState(!1);r.useEffect(()=>{e||l("LandingScreen")},[e]),r.useEffect(()=>{s(z).then(n=>{x(!1),n||(c("An error has occurred, please try again."),u(new E(new C(d,T.E32603_DEFAULT_INTERNAL_ERROR.eipCode))))})},[]);let{method:_,data:v,confirmAndSign:j,onSuccess:D,onFailure:A,uiOptions:t}=o.signMessage,L={title:(t==null?void 0:t.title)||"Sign message",description:(t==null?void 0:t.description)||"Signing this message will not cost you any fees.",buttonText:(t==null?void 0:t.buttonText)||"Sign and continue"},h=n=>{n?D(n):A(y||new E(new C("The user rejected the request.",T.E4001_USER_REJECTED_REQUEST.eipCode))),i({shouldCallAuthOnSuccess:!1}),setTimeout(()=>{b(null),c(""),u(void 0)},200)};return g.current=()=>{h(f)},a.jsx(Y,{method:_,messageData:v,copy:L,iconUrl:t!=null&&t.iconUrl&&typeof t.iconUrl=="string"?t.iconUrl:void 0,isLoading:R,success:f!==null,walletProxyIsLoading:m,errorMessage:d,isCancellable:t==null?void 0:t.isCancellable,onSign:async()=>{S(!0),c("");try{let n=await j();b(n),S(!1),setTimeout(()=>{h(n)},I)}catch(n){console.error(n),c("An error has occurred, please try again."),u(new E(new C(d,T.E32603_DEFAULT_INTERNAL_ERROR.eipCode))),S(!1)}},onCancel:()=>h(null),onClose:()=>h(f)})}};let Z=p.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
`,ee=p.p`
  && {
    margin: 0;
    width: 100%;
    text-align: center;
    color: var(--privy-color-error-dark);
    font-size: 14px;
    line-height: 22px;
  }
`,te=p(H)`
  margin-top: 0;
`,w=p(V)`
  margin-top: 0;
`;export{ue as SignRequestScreen,Y as SignRequestView,ue as default};
