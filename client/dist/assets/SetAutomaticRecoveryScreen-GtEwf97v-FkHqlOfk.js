import{dH as k,de as I,d8 as P,da as u,dc as e,ev as A,eu as v,f6 as F,eW as j,dD as M,dd as H}from"./index-DMgB8B-w.js";import{L as S,u as b,h as C}from"./ModalFooter-BldNwiHO-DEBKMbgd.js";import{r as V}from"./Subtitle-CV-2yKE4-QYPmU0JT.js";import{e as T}from"./Title-BnzYV3Is-CyePfD84.js";const B=H.div`
  && {
    border-width: 4px;
  }

  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  aspect-ratio: 1;
  border-style: solid;
  border-color: ${l=>l.$color??"var(--privy-color-accent)"};
  border-radius: 50%;
`,O={component:()=>{var p;let{user:l}=k(),{client:E,walletProxy:f,refreshSessionAndUser:R,closePrivyModal:i}=I(),s=P(),{entropyId:h,entropyIdVerifier:U}=((p=s.data)==null?void 0:p.recoverWallet)??{},[n,m]=u.useState(!1),[c,W]=u.useState(null),[d,g]=u.useState(null);function y(){var r,t,o,a;if(!n){if(d)return(t=(r=s.data)==null?void 0:r.setWalletPassword)==null||t.onFailure(d),void i();if(!c)return(a=(o=s.data)==null?void 0:o.setWalletPassword)==null||a.onFailure(Error("User exited set recovery flow")),void i()}}s.onUserCloseViaDialogOrKeybindRef.current=y;let $=!(!n&&!c);return e.jsxs(e.Fragment,d?{children:[e.jsx(S,{onClose:y},"header"),e.jsx(B,{$color:"var(--privy-color-error)",style:{alignSelf:"center"},children:e.jsx(A,{height:38,width:38,stroke:"var(--privy-color-error)"})}),e.jsx(T,{style:{marginTop:"0.5rem"},children:"Something went wrong"}),e.jsx(v,{style:{minHeight:"2rem"}}),e.jsx(b,{onClick:()=>g(null),children:"Try again"}),e.jsx(C,{})]}:{children:[e.jsx(S,{onClose:y},"header"),e.jsx(F,{style:{width:"3rem",height:"3rem",alignSelf:"center"}}),e.jsx(T,{style:{marginTop:"0.5rem"},children:"Automatically secure your account"}),e.jsx(V,{style:{marginTop:"1rem"},children:"When you log into a new device, you’ll only need to authenticate to access your account. Never get logged out if you forget your password."}),e.jsx(v,{style:{minHeight:"2rem"}}),e.jsx(b,{loading:n,disabled:$,onClick:()=>async function(){m(!0);try{let r=await E.getAccessToken(),t=j(l,h);if(!r||!f||!t)return;if(!(await f.setRecovery({accessToken:r,entropyId:h,entropyIdVerifier:U,existingRecoveryMethod:t.recoveryMethod,recoveryMethod:"privy"})).entropyId)throw Error("Unable to set recovery on wallet");let o=await R();if(!o)throw Error("Unable to set recovery on wallet");let a=j(o,t.address);if(!a)throw Error("Unabled to set recovery on wallet");W(!!o),setTimeout(()=>{var w,x;(x=(w=s.data)==null?void 0:w.setWalletPassword)==null||x.onSuccess(a),i()},M)}catch(r){g(r)}finally{m(!1)}}(),children:c?"Success":"Confirm"}),e.jsx(C,{})]})}};export{O as SetAutomaticRecoveryScreen,O as default};
