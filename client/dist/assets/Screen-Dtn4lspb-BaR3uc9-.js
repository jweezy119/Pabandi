import{dc as r,dd as n,e8 as a,e9 as y}from"./index-DMgB8B-w.js";import{L as w,h as j}from"./ModalFooter-BldNwiHO-DEBKMbgd.js";import{n as k}from"./index-CWARkn2w-Dlag2Bbu.js";const E=n.div`
  /* spacing tokens */
  --screen-space: 16px; /* base 1x = 16 */
  --screen-space-lg: calc(var(--screen-space) * 1.5); /* 24px */

  position: relative;
  overflow: hidden;
  margin: 0 calc(-1 * var(--screen-space)); /* extends over modal padding */
  height: 100%;
  border-radius: var(--privy-border-radius-lg);
`,z=n.div`
  display: flex;
  flex-direction: column;
  gap: calc(var(--screen-space) * 1.5);
  width: 100%;
  background: var(--privy-color-background);
  padding: 0 var(--screen-space-lg) var(--screen-space);
  height: 100%;
  border-radius: var(--privy-border-radius-lg);
`,S=n.div`
  position: relative;
  display: flex;
  flex-direction: column;
`,$=n(w)`
  margin: 0 -8px;
`,B=n.div`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;

  /* Enable scrolling */
  overflow-y: auto;

  /* Hide scrollbar but keep functionality when scrollable */
  /* Add padding for focus outline space, offset with negative margin */
  padding: 3px;
  margin: -3px;

  &::-webkit-scrollbar {
    display: none;
  }
  scrollbar-gutter: stable both-edges;
  scrollbar-width: none;
  -ms-overflow-style: none;

  /* Gradient effect for scroll indication */
  ${({$colorScheme:e})=>e==="light"?"background: linear-gradient(var(--privy-color-background), var(--privy-color-background) 70%) bottom, linear-gradient(rgba(0, 0, 0, 0) 20%, rgba(0, 0, 0, 0.06)) bottom;":e==="dark"?"background: linear-gradient(var(--privy-color-background), var(--privy-color-background) 70%) bottom, linear-gradient(rgba(255, 255, 255, 0) 20%, rgba(255, 255, 255, 0.06)) bottom;":void 0}

  background-repeat: no-repeat;
  background-size:
    100% 32px,
    100% 16px;
  background-attachment: local, scroll;
`,I=n.div`
  display: flex;
  flex-direction: column;
  gap: var(--screen-space-lg);
  margin-top: 1.5rem;
`;let C=n.div`
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--screen-space);
`,F=n.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`,R=n.h3`
  && {
    font-size: 20px;
    line-height: 32px;
    font-weight: 500;
    color: var(--privy-color-foreground);
    margin: 0;
  }
`,V=n.p`
  && {
    margin: 0;
    font-size: 16px;
    font-weight: 300;
    line-height: 24px;
    color: var(--privy-color-foreground);
  }
`,d=n.div`
  background: ${({$variant:e})=>{switch(e){case"success":return"var(--privy-color-success-bg)";case"warning":return"var(--privy-color-warn)";case"error":return"var(--privy-color-error-bg)";case"loading":case"logo":return"transparent";default:return"var(--privy-color-background-2)"}}};

  border-radius: 50%;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
`,H=n.div`
  display: flex;
  align-items: center;
  justify-content: center;

  img,
  svg {
    max-height: 90px;
    max-width: 180px;
  }
`,T=n.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 82px;

  > div {
    position: relative;
  }

  > div > :first-child {
    position: relative;
  }

  > div > :last-child {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  }
`;const o=({children:e,...i})=>r.jsx(E,{children:r.jsx(z,{...i,children:e})});let A=n.div`
  position: absolute;
  top: 0;
  left: calc(-1 * var(--screen-space-lg));
  width: calc(100% + calc(var(--screen-space-lg) * 2));
  height: 4px;
  background: var(--privy-color-background-2);
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
  overflow: hidden;
`,L=n(j)`
  padding: 0;
  && a {
    padding: 0;
    color: var(--privy-color-foreground-3);
  }
`,W=n.div`
  height: 100%;
  width: ${({pct:e})=>e}%;
  background: var(--privy-color-foreground-3);
  border-radius: 2px;
  transition: width 300ms ease-in-out;
`,G=({step:e})=>e?r.jsx(A,{children:r.jsx(W,{pct:Math.min(100,e.current/e.total*100)})}):null;o.Header=({title:e,subtitle:i,icon:t,iconVariant:c,iconLoadingStatus:p,showBack:g,onBack:h,showInfo:x,onInfo:v,showClose:l,onClose:u,step:s,headerTitle:f,eyebrow:m,...b})=>r.jsxs(S,{...b,children:[r.jsx($,{backFn:g?h:void 0,infoFn:x?v:void 0,onClose:l?u:void 0,title:f,eyebrow:m,closeable:l}),(t||c||e||i)&&r.jsxs(C,{children:[t||c?r.jsx(o.Icon,{icon:t,variant:c,loadingStatus:p}):null,!(!e&&!i)&&r.jsxs(F,{children:[e&&r.jsx(R,{children:e}),i&&r.jsx(V,{children:i})]})]}),s&&r.jsx(G,{step:s})]}),(o.Body=a.forwardRef(({children:e,...i},t)=>r.jsx(B,{ref:t,...i,children:e}))).displayName="Screen.Body",o.Footer=({children:e,...i})=>r.jsx(I,{id:"privy-content-footer-container",...i,children:e}),o.Actions=({children:e,...i})=>r.jsx(M,{...i,children:e}),o.HelpText=({children:e,...i})=>r.jsx(N,{...i,children:e}),o.FooterText=({children:e,...i})=>r.jsx(q,{...i,children:e}),o.Watermark=()=>r.jsx(L,{}),o.Icon=({icon:e,variant:i="subtle",loadingStatus:t})=>i==="logo"&&e?r.jsx(H,typeof e=="string"?{children:r.jsx("img",{src:e,alt:""})}:a.isValidElement(e)?{children:e}:{children:a.createElement(e)}):i==="loading"?e?r.jsx(T,{children:r.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"center"},children:[r.jsx(y,{success:t==null?void 0:t.success,fail:t==null?void 0:t.fail}),typeof e=="string"?r.jsx("span",{style:{background:`url('${e}') 0 0 / contain`,height:"38px",width:"38px",borderRadius:"6px",margin:"auto",backgroundSize:"contain"}}):a.isValidElement(e)?a.cloneElement(e,{style:{width:"38px",height:"38px"}}):a.createElement(e,{style:{width:"38px",height:"38px"}})]})}):r.jsx(d,{$variant:i,children:r.jsx(k,{size:"64px"})}):r.jsx(d,{$variant:i,children:e&&(typeof e=="string"?r.jsx("img",{src:e,alt:"",style:{width:"32px",height:"32px",borderRadius:"6px"}}):a.isValidElement(e)?e:a.createElement(e,{width:32,height:32,stroke:(()=>{switch(i){case"success":return"var(--privy-color-icon-success)";case"warning":return"var(--privy-color-icon-warning)";case"error":return"var(--privy-color-icon-error)";default:return"var(--privy-color-icon-muted)"}})(),strokeWidth:2}))});let M=n.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: calc(var(--screen-space) / 2);
`,N=n.div`
  && {
    margin: 0;
    width: 100%;
    text-align: center;
    color: var(--privy-color-foreground-2);
    font-size: 13px;
    line-height: 20px;

    & a {
      text-decoration: underline;
    }
  }
`,q=n.div`
  && {
    margin-top: -1rem;
    width: 100%;
    text-align: center;
    color: var(--privy-color-foreground-2);
    font-size: 0.6875rem; /* 11px */
    line-height: 1rem; /* 16px */
  }
`;export{o as w};
