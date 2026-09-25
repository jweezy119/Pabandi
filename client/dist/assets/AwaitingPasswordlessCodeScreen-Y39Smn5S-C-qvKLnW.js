import{da as s,d8 as re,d9 as G,de as oe,dH as ae,dD as Q,dc as r,dS as E,dh as b,dP as te,eG as ne,dF as ie,dd as C}from"./index-DMgB8B-w.js";import{F as se}from"./EnvelopeIcon-NVE-h5aw.js";import{o as le}from"./Layouts-BMRfo5hw-DUEqUByN.js";import{i as ce}from"./Link-BdDilT2T-l_0PhETq.js";import{a as de}from"./shouldProceedtoEmbeddedWalletCreationFlow-BxvaW_Vy-CbmfoSAH.js";import{n as ue}from"./ScreenLayout-XFsWudNK-CpWvBU0O.js";import"./ModalFooter-BldNwiHO-DEBKMbgd.js";import"./Screen-Dtn4lspb-BaR3uc9-.js";import"./index-CWARkn2w-Dlag2Bbu.js";function pe({title:o,titleId:p,...S},m){return s.createElement("svg",Object.assign({xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20",fill:"currentColor","aria-hidden":"true","data-slot":"icon",ref:m,"aria-labelledby":p},S),o?s.createElement("title",{id:p},o):null,s.createElement("path",{fillRule:"evenodd",d:"M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z",clipRule:"evenodd"}))}const me=s.forwardRef(pe),fe=({contactMethod:o,authFlow:p,emailDomain:S,appName:m="Privy",whatsAppEnabled:I=!1,onBack:l,onCodeSubmit:T,onResend:M,errorMessage:f,success:y=!1,resendCountdown:D=0,onInvalidInput:_,onClearError:v})=>{let[d,N]=s.useState(J);s.useEffect(()=>{f||N(J)},[f]);let w=async g=>{var x;g.preventDefault();let n=g.currentTarget.value.replace(" ","");if(n==="")return;if(isNaN(Number(n)))return void(_==null?void 0:_("Code should be numeric"));v==null||v();let h=Number((x=g.currentTarget.name)==null?void 0:x.charAt(5)),c=[...n||[""]].slice(0,Z-h),t=[...d.slice(0,h),...c,...d.slice(h+c.length)];N(t);let A=Math.min(Math.max(h+c.length,0),Z-1);if(!isNaN(Number(g.currentTarget.value))){let a=document.querySelector(`input[name=code-${A}]`);a==null||a.focus()}if(t.every(a=>a&&!isNaN(+a))){let a=document.querySelector(`input[name=code-${A}]`);a==null||a.blur(),await(T==null?void 0:T(t.join("")))}};return r.jsx(ue,{title:"Enter confirmation code",subtitle:r.jsxs("span",p==="email"?{children:["Please check ",r.jsx(ee,{children:o})," for an email from"," ",S??"privy.io"," and enter your code below."]}:{children:["Please check ",r.jsx(ee,{children:o})," for a",I?" WhatsApp":""," message from ",m," and enter your code below."]}),icon:p==="email"?se:ne,onBack:l,showBack:!0,helpText:r.jsxs(Ee,{children:[r.jsxs("span",{children:["Didn't get ",p==="email"?"an email":"a message","?"]}),D?r.jsxs(be,{children:[r.jsx(me,{color:"var(--privy-color-foreground)",strokeWidth:1.33,height:"12px",width:"12px"}),r.jsx("span",{children:"Code sent"})]}):r.jsx(ce,{as:"button",size:"sm",onClick:M,children:"Resend code"})]}),children:r.jsx(xe,{children:r.jsx(le,{children:r.jsxs(ye,{children:[r.jsx("div",{children:d.map((g,n)=>r.jsx("input",{name:`code-${n}`,type:"text",value:d[n],onChange:w,onKeyUp:h=>{h.key==="Backspace"&&(c=>{if(v==null||v(),N([...d.slice(0,c),"",...d.slice(c+1)]),c>0){let t=document.querySelector(`input[name=code-${c-1}]`);t==null||t.focus()}})(n)},inputMode:"numeric",autoFocus:n===0,pattern:"[0-9]",className:`${y?"success":""} ${f?"fail":""}`,autoComplete:ie?"one-time-code":"off"},n))}),r.jsx(ge,{$fail:!!f,$success:y,children:r.jsx("span",{children:f==="Invalid or expired verification code"?"Incorrect code":f||(y?"Success!":"")})})]})})})})};let Z=6,J=Array(6).fill("");var R,k,ve=((R=ve||{})[R.RESET_AFTER_DELAY=0]="RESET_AFTER_DELAY",R[R.CLEAR_ON_NEXT_VALID_INPUT=1]="CLEAR_ON_NEXT_VALID_INPUT",R),he=((k=he||{})[k.EMAIL=0]="EMAIL",k[k.SMS=1]="SMS",k);const je={component:()=>{var F,P,U;let{navigate:o,lastScreen:p,navigateBack:S,setModalData:m,onUserCloseViaDialogOrKeybindRef:I}=re(),l=G(),{closePrivyModal:T,resendEmailCode:M,resendSmsCode:f,getAuthMeta:y,loginWithCode:D,updateWallets:_,createAnalyticsEvent:v}=oe(),{authenticated:d,logout:N,user:w}=ae(),{whatsAppEnabled:g}=G(),[n,h]=s.useState(!1),[c,t]=s.useState(null),[A,x]=s.useState(null),[a,L]=s.useState(0);I.current=()=>null;let j=(F=y())!=null&&F.email?0:1,O=j===0?((P=y())==null?void 0:P.email)||"":((U=y())==null?void 0:U.phoneNumber)||"",$=Q-500;return s.useEffect(()=>{if(a){let i=setTimeout(()=>{L(a-1)},1e3);return()=>clearTimeout(i)}},[a]),s.useEffect(()=>{if(d&&n&&w){if(l!=null&&l.legal.requireUsersAcceptTerms&&!w.hasAcceptedTerms){let i=setTimeout(()=>{o("AffirmativeConsentScreen")},$);return()=>clearTimeout(i)}if(de(w,l.embeddedWallets)){let i=setTimeout(()=>{m({createWallet:{onSuccess:()=>{},onFailure:u=>{console.error(u),v({eventName:"embedded_wallet_creation_failure_logout",payload:{error:u,screen:"AwaitingPasswordlessCodeScreen"}}),N()},callAuthOnSuccessOnClose:!0}}),o("EmbeddedWalletOnAccountCreateScreen")},$);return()=>clearTimeout(i)}{_();let i=setTimeout(()=>T({shouldCallAuthOnSuccess:!0,isSuccess:!0}),Q);return()=>clearTimeout(i)}}},[d,n,w]),s.useEffect(()=>{if(c&&A===0){let i=setTimeout(()=>{t(null),x(null);let u=document.querySelector("input[name=code-0]");u==null||u.focus()},1400);return()=>clearTimeout(i)}},[c,A]),r.jsx(fe,{contactMethod:O,authFlow:j===0?"email":"sms",emailDomain:l==null?void 0:l.appearance.emailDomain,appName:l==null?void 0:l.name,whatsAppEnabled:g,onBack:()=>S(),onCodeSubmit:async i=>{var u,W,B,q,V,K,z,H,X,Y;try{await D(i),h(!0)}catch(e){if(e instanceof E&&e.privyErrorCode===b.INVALID_CREDENTIALS)t("Invalid or expired verification code"),x(0);else if(e instanceof E&&e.privyErrorCode===b.CANNOT_LINK_MORE_OF_TYPE)t(e.message);else{if(e instanceof E&&e.privyErrorCode===b.USER_LIMIT_REACHED)return console.error(new te(e).toString()),void o("UserLimitReachedScreen");if(e instanceof E&&e.privyErrorCode===b.USER_DOES_NOT_EXIST)return void o("AccountNotFoundScreen");if(e instanceof E&&e.privyErrorCode===b.LINKED_TO_ANOTHER_USER)return m({errorModalData:{error:e,previousScreen:p??"AwaitingPasswordlessCodeScreen"}}),void o("ErrorScreen",!1);if(e instanceof E&&e.privyErrorCode===b.DISALLOWED_PLUS_EMAIL)return m({inlineError:{error:e}}),void o("ConnectOrCreateScreen",!1);if(e instanceof E&&e.privyErrorCode===b.ACCOUNT_TRANSFER_REQUIRED&&((W=(u=e.data)==null?void 0:u.data)!=null&&W.nonce))return m({accountTransfer:{nonce:(q=(B=e.data)==null?void 0:B.data)==null?void 0:q.nonce,account:O,displayName:(z=(K=(V=e.data)==null?void 0:V.data)==null?void 0:K.account)==null?void 0:z.displayName,linkMethod:j===0?"email":"sms",embeddedWalletAddress:(Y=(X=(H=e.data)==null?void 0:H.data)==null?void 0:X.otherUser)==null?void 0:Y.embeddedWalletAddress}}),void o("LinkConflictScreen");t("Issue verifying code"),x(0)}}},onResend:async()=>{L(30),j===0?await M():await f()},errorMessage:c||void 0,success:n,resendCountdown:a,onInvalidInput:i=>{t(i),x(1)},onClearError:()=>{A===1&&(t(null),x(null))}})}};let xe=C.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: auto;
  gap: 16px;
  flex-grow: 1;
  width: 100%;
`,ye=C.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 12px;

  > div:first-child {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    border-radius: var(--privy-border-radius-sm);

    > input {
      border: 1px solid var(--privy-color-foreground-4);
      background: var(--privy-color-background);
      border-radius: var(--privy-border-radius-sm);
      padding: 8px 10px;
      height: 48px;
      width: 40px;
      text-align: center;
      font-size: 18px;
      font-weight: 600;
      color: var(--privy-color-foreground);
      transition: all 0.2s ease;
    }

    > input:focus {
      border: 1px solid var(--privy-color-foreground);
      box-shadow: 0 0 0 1px var(--privy-color-foreground);
    }

    > input:invalid {
      border: 1px solid var(--privy-color-error);
    }

    > input.success {
      border: 1px solid var(--privy-color-border-success);
      background: var(--privy-color-success-bg);
    }

    > input.fail {
      border: 1px solid var(--privy-color-border-error);
      background: var(--privy-color-error-bg);
      animation: shake 180ms;
      animation-iteration-count: 2;
    }
  }

  @keyframes shake {
    0% {
      transform: translate(1px, 0);
    }
    33% {
      transform: translate(-1px, 0);
    }
    67% {
      transform: translate(-1px, 0);
    }
    100% {
      transform: translate(1px, 0);
    }
  }
`,ge=C.div`
  line-height: 20px;
  min-height: 20px;
  font-size: 14px;
  font-weight: 400;
  color: ${o=>o.$success?"var(--privy-color-success-dark)":o.$fail?"var(--privy-color-error-dark)":"transparent"};
  display: flex;
  justify-content: center;
  width: 100%;
  text-align: center;
`,Ee=C.div`
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  width: 100%;
  color: var(--privy-color-foreground-2);
`,be=C.div`
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--privy-border-radius-sm);
  padding: 2px 8px;
  gap: 4px;
  background: var(--privy-color-background-2);
  color: var(--privy-color-foreground-2);
`,ee=C.span`
  font-weight: 500;
  word-break: break-all;
  color: var(--privy-color-foreground);
`;export{je as AwaitingPasswordlessCodeScreen,fe as AwaitingPasswordlessCodeScreenView,je as default};
