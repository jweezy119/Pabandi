import{b$ as $,dc as n,dn as j,dd as l}from"./index-DMgB8B-w.js";import{l as g,i as a,o as d,c as h}from"./ethers-DNxEwCFm-LOYz0Zs3.js";import{r as k}from"./getFormattedUsdFromLamports-De3U9GlO-C446pzMl.js";import{t as y}from"./transaction-BNTP-bFm-CrebgH-D.js";const O=({weiQuantities:e,tokenPrice:r,tokenSymbol:o})=>{let i=a(e),t=r?d(i,r):void 0,s=h(i,o);return n.jsx(c,{children:t||s})},P=({weiQuantities:e,tokenPrice:r,tokenSymbol:o})=>{let i=a(e),t=r?d(i,r):void 0,s=h(i,o);return n.jsx(c,{children:t?n.jsxs(n.Fragment,{children:[n.jsx(S,{children:"USD"}),t==="<$0.01"?n.jsxs(x,{children:[n.jsx(p,{children:"<"}),"$0.01"]}):t]}):s})},D=({quantities:e,tokenPrice:r,tokenSymbol:o="SOL",tokenDecimals:i=9})=>{let t=e.reduce((u,f)=>u+f,0n),s=r&&o==="SOL"&&i===9?k(t,r):void 0,m=o==="SOL"&&i===9?y(t):`${$(t,i)} ${o}`;return n.jsx(c,{children:s?n.jsx(n.Fragment,{children:s==="<$0.01"?n.jsxs(x,{children:[n.jsx(p,{children:"<"}),"$0.01"]}):s}):m})};let c=l.span`
  font-size: 14px;
  line-height: 140%;
  display: flex;
  gap: 4px;
  align-items: center;
`,S=l.span`
  font-size: 12px;
  line-height: 12px;
  color: var(--privy-color-foreground-3);
`,p=l.span`
  font-size: 10px;
`,x=l.span`
  display: flex;
  align-items: center;
`;function v(e,r){return`https://explorer.solana.com/account/${e}?chain=${r}`}const F=e=>n.jsx(b,{href:e.chainType==="ethereum"?g(e.chainId,e.walletAddress):v(e.walletAddress,e.chainId),target:"_blank",children:j(e.walletAddress)});let b=l.a`
  &:hover {
    text-decoration: underline;
  }
`;export{F as S,D as f,P as h,O as p};
