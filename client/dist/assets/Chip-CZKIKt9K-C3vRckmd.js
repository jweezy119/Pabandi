import{dc as n,ee as s,ef as l,dd as c}from"./index-DMgB8B-w.js";import{i as t}from"./LoadingSkeleton-BMsgO5PV-B8ofmYI_.js";const p=({children:o,color:i,isLoading:r,isPulsing:e,...a})=>n.jsx(d,{$color:i,$isLoading:r,$isPulsing:e,...a,children:o});let d=c.span`
  padding: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1rem; /* 150% */
  border-radius: var(--privy-border-radius-xs);
  display: flex;
  align-items: center;
  ${o=>{let i,r;o.$color==="green"&&(i="var(--privy-color-success-dark)",r="var(--privy-color-success-light)"),o.$color==="red"&&(i="var(--privy-color-error)",r="var(--privy-color-error-light)"),o.$color==="gray"&&(i="var(--privy-color-foreground-2)",r="var(--privy-color-background-2)");let e=s`
      from, to {
        background-color: ${r};
      }

      50% {
        background-color: rgba(${r}, 0.8);
      }
    `;return l`
      color: ${i};
      background-color: ${r};
      ${o.$isPulsing&&l`
        animation: ${e} 3s linear infinite;
      `};
    `}}

  ${t}
`;export{p as n};
