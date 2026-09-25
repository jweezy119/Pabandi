import{d8 as F,d9 as T,de as I,da as d,dD as w,dc as a,dF as y,ew as B,dA as O,dd as n}from"./index-DMgB8B-w.js";import{h as _}from"./CopyToClipboard-i_OQSBJr-DN3shWIG.js";import{n as q}from"./OpenLink-CUpJ1mOr-D3EBXH49.js";import{x as A}from"./QrCode-cA9rnMIN-DdFklOKJ.js";import{n as E}from"./ScreenLayout-XFsWudNK-CpWvBU0O.js";import{l as h}from"./farcaster-DPlSjvF5-BwN8kxal.js";import"./ModalFooter-BldNwiHO-DEBKMbgd.js";import"./Screen-Dtn4lspb-BaR3uc9-.js";import"./index-CWARkn2w-Dlag2Bbu.js";let S="#8a63d2";const M=({appName:u,loading:m,success:i,errorMessage:e,connectUri:r,onBack:s,onClose:c,onOpenFarcaster:o})=>a.jsx(E,y||m?B?{title:e?e.message:"Add a signer to Farcaster",subtitle:e?e.detail:`This will allow ${u} to add casts, likes, follows, and more on your behalf.`,icon:h,iconVariant:"loading",iconLoadingStatus:{success:i,fail:!!e},primaryCta:r&&o?{label:"Open Farcaster app",onClick:o}:void 0,onBack:s,onClose:c,watermark:!0}:{title:e?e.message:"Requesting signer from Farcaster",subtitle:e?e.detail:"This should only take a moment",icon:h,iconVariant:"loading",iconLoadingStatus:{success:i,fail:!!e},onBack:s,onClose:c,watermark:!0,children:r&&y&&a.jsx(R,{children:a.jsx(q,{text:"Take me to Farcaster",url:r,color:S})})}:{title:"Add a signer to Farcaster",subtitle:`This will allow ${u} to add casts, likes, follows, and more on your behalf.`,onBack:s,onClose:c,watermark:!0,children:a.jsxs(D,{children:[a.jsx(L,{children:r?a.jsx(A,{url:r,size:275,squareLogoElement:h}):a.jsx(V,{children:a.jsx(O,{})})}),a.jsxs(N,{children:[a.jsx(P,{children:"Or copy this link and paste it into a phone browser to open the Farcaster app."}),r&&a.jsx(_,{text:r,itemName:"link",color:S})]})]})});let R=n.div`
  margin-top: 24px;
`,D=n.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
`,L=n.div`
  padding: 24px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 275px;
`,N=n.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`,P=n.div`
  font-size: 0.875rem;
  text-align: center;
  color: var(--privy-color-foreground-2);
`,V=n.div`
  position: relative;
  width: 82px;
  height: 82px;
`;const Y={component:()=>{let{lastScreen:u,navigateBack:m,data:i}=F(),e=T(),{requestFarcasterSignerStatus:r,closePrivyModal:s}=I(),[c,o]=d.useState(void 0),[k,v]=d.useState(!1),[j,x]=d.useState(!1),g=d.useRef([]),t=i==null?void 0:i.farcasterSigner;d.useEffect(()=>{let b=Date.now(),l=setInterval(async()=>{if(!(t!=null&&t.public_key))return clearInterval(l),void o({retryable:!0,message:"Connect failed",detail:"Something went wrong. Please try again."});t.status==="approved"&&(clearInterval(l),v(!1),x(!0),g.current.push(setTimeout(()=>s({shouldCallAuthOnSuccess:!1,isSuccess:!0}),w)));let p=await r(t==null?void 0:t.public_key),C=Date.now()-b;p.status==="approved"?(clearInterval(l),v(!1),x(!0),g.current.push(setTimeout(()=>s({shouldCallAuthOnSuccess:!1,isSuccess:!0}),w))):C>3e5?(clearInterval(l),o({retryable:!0,message:"Connect failed",detail:"The request timed out. Try again."})):p.status==="revoked"&&(clearInterval(l),o({retryable:!0,message:"Request rejected",detail:"The request was rejected. Please try again."}))},2e3);return()=>{clearInterval(l),g.current.forEach(p=>clearTimeout(p))}},[]);let f=(t==null?void 0:t.status)==="pending_approval"?t.signer_approval_url:void 0;return a.jsx(M,{appName:e.name,loading:k,success:j,errorMessage:c,connectUri:f,onBack:u?m:void 0,onClose:s,onOpenFarcaster:()=>{f&&(window.location.href=f)}})}};export{Y as FarcasterSignerStatusScreen,M as FarcasterSignerStatusView,Y as default};
