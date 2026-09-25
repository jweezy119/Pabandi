import{dc as e,ed as p,d9 as P,da as d,dd as l}from"./index-DMgB8B-w.js";import{p as S,S as u,h as v}from"./WalletLink-wyEl6U-t-AULGDOqW.js";import{c as g}from"./ethers-DNxEwCFm-LOYz0Zs3.js";import{a as f}from"./Layouts-BMRfo5hw-DUEqUByN.js";import{F as I}from"./ChevronDownIcon-B5nwM4LI.js";const h=({label:t,children:r,valueStyles:i})=>e.jsxs(C,{children:[e.jsx("div",{children:t}),e.jsx(B,{style:{...i},children:r})]});let C=l.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;

  > :first-child {
    color: var(--privy-color-foreground-3);
    text-align: left;
  }

  > :last-child {
    color: var(--privy-color-foreground-2);
    text-align: right;
  }
`,B=l.div`
  font-size: 14px;
  line-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--privy-border-radius-full);
  background-color: var(--privy-color-background-2);
  padding: 4px 8px;
`;const A=({gas:t,tokenPrice:r,tokenSymbol:i})=>e.jsxs(f,{style:{paddingBottom:"12px"},children:[e.jsxs(j,{children:[e.jsx(y,{children:"Est. Fees"}),e.jsx("div",{children:e.jsx(v,{weiQuantities:[BigInt(t)],tokenPrice:r,tokenSymbol:i})})]}),r&&e.jsx(m,{children:`${g(BigInt(t),i)}`})]}),F=({value:t,gas:r,tokenPrice:i,tokenSymbol:n})=>{let o=BigInt(t??0)+BigInt(r);return e.jsxs(f,{children:[e.jsxs(j,{children:[e.jsx(y,{children:"Total (including fees)"}),e.jsx("div",{children:e.jsx(v,{weiQuantities:[BigInt(t||0),BigInt(r)],tokenPrice:i,tokenSymbol:n})})]}),i&&e.jsx(m,{children:g(o,n)})]})};let j=l.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding-top: 4px;
`,m=l.div`
  display: flex;
  flex-direction: row;
  height: 12px;

  font-size: 12px;
  line-height: 12px;
  color: var(--privy-color-foreground-3);
  font-weight: 400;
`,y=l.div`
  font-size: 14px;
  line-height: 22.4px;
  font-weight: 400;
`;const s=d.createContext(void 0),a=d.createContext(void 0),T=({defaultValue:t,children:r})=>{let[i,n]=d.useState(t||null);return e.jsx(s.Provider,{value:{activePanel:i,togglePanel:o=>{n(i===o?null:o)}},children:e.jsx(V,{children:r})})},z=({value:t,children:r})=>{let{activePanel:i,togglePanel:n}=d.useContext(s),o=i===t;return e.jsx(a.Provider,{value:{onToggle:()=>n(t),value:t},children:e.jsx(H,{isActive:o?"true":"false","data-open":String(o),children:r})})},$=({children:t})=>{let{activePanel:r}=d.useContext(s),{onToggle:i,value:n}=d.useContext(a),o=r===n;return e.jsxs(e.Fragment,{children:[e.jsxs(W,{onClick:i,"data-open":String(o),children:[e.jsx(R,{children:t}),e.jsx(q,{isactive:o?"true":"false",children:e.jsx(I,{height:"16px",width:"16px",strokeWidth:"2"})})]}),e.jsx(D,{})]})},E=({children:t})=>{let{activePanel:r}=d.useContext(s),{value:i}=d.useContext(a);return e.jsx(L,{"data-open":String(r===i),children:e.jsx(b,{children:t})})},Q=({children:t})=>{let{activePanel:r}=d.useContext(s),{value:i}=d.useContext(a);return e.jsx(b,{children:typeof t=="function"?t({isActive:r===i}):t})};let V=l.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 8px;
`,W=l.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  cursor: pointer;
  padding-bottom: 8px;
`,D=l.div`
  width: 100%;

  && {
    border-top: 1px solid;
    border-color: var(--privy-color-foreground-4);
  }
  padding-bottom: 12px;
`,R=l.div`
  font-size: 14px;
  font-weight: 500;
  line-height: 19.6px;
  width: 100%;
  padding-right: 8px;
`,H=l.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
  padding: 12px;

  && {
    border: 1px solid;
    border-color: var(--privy-color-foreground-4);
    border-radius: var(--privy-border-radius-md);
  }
`,L=l.div`
  position: relative;
  overflow: hidden;
  transition: max-height 25ms ease-out;

  &[data-open='true'] {
    max-height: 700px;
  }

  &[data-open='false'] {
    max-height: 0;
  }
`,b=l.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1 1 auto;
  min-height: 1px;
`,q=l.div`
  transform: ${t=>t.isactive==="true"?"rotate(180deg)":"rotate(0deg)"};
`;const X=({from:t,to:r,txn:i,transactionInfo:n,tokenPrice:o,gas:c,tokenSymbol:x})=>{let w=BigInt((i==null?void 0:i.value)||0);return e.jsx(T,{...P().render.standalone?{defaultValue:"details"}:{},children:e.jsxs(z,{value:"details",children:[e.jsx($,{children:e.jsxs(G,{children:[e.jsx("div",{children:(n==null?void 0:n.title)||"Details"}),e.jsx(J,{children:e.jsx(S,{weiQuantities:[w],tokenPrice:o,tokenSymbol:x})})]})}),e.jsxs(E,{children:[e.jsx(h,{label:"From",children:e.jsx(u,{walletAddress:t,chainId:i.chainId||p,chainType:"ethereum"})}),e.jsx(h,{label:"To",children:e.jsx(u,{walletAddress:r,chainId:i.chainId||p,chainType:"ethereum"})}),n&&n.action&&e.jsx(h,{label:"Action",children:n.action}),c&&e.jsx(A,{value:i.value,gas:c,tokenPrice:o,tokenSymbol:x})]}),e.jsx(Q,{children:({isActive:k})=>e.jsx(F,{value:i.value,displayFee:k,gas:c||"0x0",tokenPrice:o,tokenSymbol:x})})]})})};let G=l.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`,J=l.div`
  flex-shrink: 0;
  padding-left: 8px;
`;export{X as $};
