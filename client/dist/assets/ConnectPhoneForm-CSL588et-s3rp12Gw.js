import{da as l,d9 as z,ej as E,em as c,en as T,eo as U,ep as q,eq as L,dc as t,er as s,dd as w,es as R}from"./index-DMgB8B-w.js";import{w as D,b as B}from"./ModalFooter-BldNwiHO-DEBKMbgd.js";import{n as I}from"./Chip-CZKIKt9K-C3vRckmd.js";const F=({value:e,onChange:u})=>t.jsx("select",{value:e,onChange:u,children:R.map(n=>t.jsxs("option",{value:n.code,children:[n.code," +",n.callCode]},n.code))}),H=l.forwardRef((e,u)=>{let n=z(),[y,C]=l.useState(!1),{accountType:k}=E(),[a,h]=l.useState(""),[r,j]=l.useState(e.defaultCountry??(n==null?void 0:n.intl.defaultCountry)??"US"),S=c(a,r),g=T(r),N=U(r),P=q(r),x=!S,[b,f]=l.useState(!1),V=P.length,m=o=>{let i=o.target.value;j(i),h(""),e.onChange&&e.onChange({rawPhoneNumber:a,qualifiedPhoneNumber:s(a,i),countryCode:i,isValid:c(a,r)})},v=(o,i)=>{try{let d=o.replace(/\D/g,"")===a.replace(/\D/g,"")?o:g.input(o);h(d),e.onChange&&e.onChange({rawPhoneNumber:d,qualifiedPhoneNumber:s(o,i),countryCode:i,isValid:c(o,i)})}catch(d){console.error("Error processing phone number:",d)}},p=()=>{f(!0);let o=s(a,r);e.onSubmit({rawPhoneNumber:a,qualifiedPhoneNumber:o,countryCode:r,isValid:c(a,r)}).finally(()=>f(!1))};return l.useEffect(()=>{if(e.defaultValue){let o=L(e.defaultValue);g.reset(),m({target:{value:o.countryCode}}),v(o.phone,o.countryCode)}},[e.defaultValue]),t.jsxs(t.Fragment,{children:[t.jsx(K,{children:t.jsxs(W,{$callingCodeLength:V,$stacked:e.stacked,children:[t.jsx(F,{value:r,onChange:m}),t.jsx("input",{ref:u,id:"phone-number-input",className:"login-method-button",type:"tel",placeholder:N,onFocus:()=>C(!0),onChange:o=>{v(o.target.value,r)},onKeyUp:o=>{o.key==="Enter"&&p()},value:a,autoComplete:"tel"}),k!=="phone"||y||e.hideRecent?e.stacked||e.noIncludeSubmitButton?t.jsx("span",{}):t.jsx(D,{isSubmitting:b,onClick:p,disabled:x,children:"Submit"}):t.jsx(I,{color:"gray",children:"Recent"})]})}),e.stacked&&!e.noIncludeSubmitButton?t.jsx(B,{loading:b,loadingText:null,onClick:p,disabled:x,children:"Submit"}):null]})});let K=w.div`
  width: 100%;
`,W=w.label`
  --country-code-dropdown-width: calc(54px + calc(12 * ${e=>e.$callingCodeLength}px));
  --phone-input-extra-padding-left: calc(12px + calc(3 * ${e=>e.$callingCodeLength}px));
  display: block;
  position: relative;
  width: 100%;

  /* Tablet and Up */
  @media (min-width: 441px) {
    --country-code-dropdown-width: calc(52px + calc(10 * ${e=>e.$callingCodeLength}px));
  }

  && > select {
    font-size: 16px;
    height: 24px;
    position: absolute;
    margin: 13px calc(var(--country-code-dropdown-width) / 4);
    line-height: 24px;
    width: var(--country-code-dropdown-width);
    background-color: var(--privy-color-background);
    background-size: auto;
    background-position-x: right;
    cursor: pointer;

    /* Tablet and Up */
    @media (min-width: 441px) {
      font-size: 14px;
      width: var(--country-code-dropdown-width);
    }

    :focus {
      outline: none;
      box-shadow: none;
    }
  }

  && > input {
    font-size: 16px;
    line-height: 24px;
    color: var(--privy-color-foreground);

    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;

    padding: 12px 88px 12px
      calc(var(--country-code-dropdown-width) + var(--phone-input-extra-padding-left));
    padding-right: ${e=>e.$stacked?"16px":"88px"};
    flex-grow: 1;
    background: var(--privy-color-background);
    border: 1px solid var(--privy-color-foreground-4);
    border-radius: var(--privy-border-radius-md);
    width: 100%;

    :focus {
      outline: none;
      border-color: var(--privy-color-accent);
    }

    :autofill,
    :-webkit-autofill {
      background: var(--privy-color-background);
    }

    /* Tablet and Up */
    @media (min-width: 441px) {
      font-size: 14px;
      padding-right: 78px;
    }
  }

  && > :last-child {
    right: 16px;
    position: absolute;
    top: 50%;
    transform: translate(0, -50%);
  }

  && > button:last-child {
    right: 0;
    line-height: 24px;
    padding: 13px 17px;

    :focus {
      outline: none;
      border-color: var(--privy-color-accent);
    }
  }

  && > input::placeholder {
    color: var(--privy-color-foreground-3);
  }
`;export{H as y};
