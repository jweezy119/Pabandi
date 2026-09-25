import{dc as e,ex as h,da as l,dd as o}from"./index-DMgB8B-w.js";import{n as E}from"./ScreenLayout-XFsWudNK-CpWvBU0O.js";import{C as S}from"./chevron-down-C7_vouoy.js";const O=({currency:t="usd",value:s,onChange:i,inputMode:a="decimal",autoFocus:p})=>{var y;let[u,k]=l.useState("0"),[m,C]=l.useState(null),g=l.useRef(null),v=l.useRef(null),d=s??u,x=((y=h[t])==null?void 0:y.symbol)??"$",c=d.length>9?"small":d.length>6?"compact":"default";l.useLayoutEffect(()=>{var n;let r=(n=v.current)==null?void 0:n.offsetWidth;C(r?Math.ceil(r)+2:null)},[c,d]);let z=l.useCallback(r=>{let n=r.target.value,f=(n=n.replace(/[^\d.]/g,"")).split(".");f.length>2&&(n=f[0]+"."+f.slice(1).join(""));let[A="",b]=n.split("."),w=A.replace(/^0+(?=\d)/,"");((n=b!==void 0?`${w||"0"}.${b}`:w||"0")===""||n===".")&&(n="0"),i?i(n):k(n)},[i]),$=l.useCallback(r=>{!(["Delete","Backspace","Tab","Escape","Enter",".","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(r.key)||(r.ctrlKey||r.metaKey)&&["a","c","v","x"].includes(r.key.toLowerCase()))&&(r.key>="0"&&r.key<="9"||r.preventDefault())},[]);return e.jsxs(L,{$size:c,onClick:()=>{var r;return(r=g.current)==null?void 0:r.focus()},children:[e.jsx(j,{$size:c,children:x}),e.jsx(D,{ref:g,type:"text",inputMode:a,value:d,onChange:z,onKeyDown:$,autoFocus:p,placeholder:"0","aria-label":"Amount",style:m?{width:`${m}px`}:void 0}),e.jsx(R,{ref:v,"aria-hidden":"true",children:d}),e.jsx(j,{$size:c,style:{opacity:0},children:x})]})},P=({selectedAsset:t,onEditSourceAsset:s})=>{let{icon:i}=h[t];return e.jsxs(B,{onClick:s,children:[e.jsx(K,{children:i}),e.jsx(M,{children:t.toLocaleUpperCase()}),e.jsx(U,{children:e.jsx(S,{})})]})};let L=o.span`
  position: relative;
  background-color: var(--privy-color-background);
  width: 100%;
  box-sizing: border-box;
  text-align: center;
  font-kerning: none;
  font-feature-settings: 'calt' off;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  cursor: pointer;

  && {
    color: var(--privy-color-foreground);
    font-size: ${({$size:t})=>t==="small"?"2.25rem":t==="compact"?"3rem":"3.75rem"};
    font-style: normal;
    font-weight: 600;
    line-height: 5.375rem;
  }
`,D=o.input`
  appearance: none;
  align-self: flex-start;
  min-width: 1ch;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: inherit;
  letter-spacing: inherit;
  text-align: left;
  caret-color: currentcolor;

  &:focus {
    outline: none !important;
    border: none !important;
    box-shadow: none !important;
  }
`,R=o.span`
  position: absolute;
  visibility: hidden;
  white-space: pre;
  pointer-events: none;
`,j=o.span`
  color: var(--privy-color-foreground);
  font-kerning: none;
  font-feature-settings: 'calt' off;
  font-size: ${({$size:t})=>t==="small"?"0.75rem":t==="compact"?"0.875rem":"1rem"};
  font-style: normal;
  font-weight: 600;
  line-height: 1.5rem;
  margin-top: 0.75rem;
`,B=o.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: auto;
  gap: 0.5rem;
  border: 1px solid var(--privy-color-border-default);
  border-radius: var(--privy-border-radius-full);

  && {
    margin: auto;
    padding: 0.5rem 1rem;
  }
`,K=o.div`
  svg {
    width: 1rem;
    height: 1rem;
    border-radius: var(--privy-border-radius-full);
    overflow: hidden;
    border: solid 0.1px var(--privy-color-border-default);
  }
`,M=o.span`
  color: var(--privy-color-foreground);
  font-kerning: none;
  font-feature-settings: 'calt' off;
  font-size: 0.875rem;
  font-style: normal;
  font-weight: 500;
  line-height: 1.375rem;
`,U=o.div`
  color: var(--privy-color-foreground);

  svg {
    width: 1.25rem;
    height: 1.25rem;
  }
`;const Q=({opts:t,isLoading:s,onSelectSource:i})=>e.jsx(E,{showClose:!1,showBack:!0,onBack:()=>i(t.source.selectedAsset),title:"Select currency",children:e.jsx(F,{children:t.source.assets.map(a=>{let{icon:p,name:u}=h[a];return e.jsx(H,{onClick:()=>i(a),disabled:s,children:e.jsxs(T,{children:[e.jsx(V,{children:p}),e.jsxs(W,{children:[e.jsx(q,{children:u}),e.jsx(G,{children:a.toLocaleUpperCase()})]})]})},a)})})});let F=o.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  max-height: 20.875rem;
  overflow-y: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`,H=o.button`
  border-color: var(--privy-color-border-default);
  border-width: 1px;
  border-radius: var(--privy-border-radius-mdlg);
  border-style: solid;
  display: flex;

  && {
    padding: 0.75rem 1rem;
  }
`,T=o.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
`,V=o.div`
  svg {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--privy-border-radius-full);
    overflow: hidden;
    border: solid 0.1px var(--privy-color-border-default);
  }
`,W=o.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.125rem;
`,q=o.span`
  color: var(--privy-color-foreground);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.25rem;
`,G=o.span`
  color: var(--privy-color-foreground-3);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.125rem;
`;export{O as c,P as p,Q as w};
