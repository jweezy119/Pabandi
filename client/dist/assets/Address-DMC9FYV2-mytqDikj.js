import{da as d,dc as e,dn as p,dd as t}from"./index-DMgB8B-w.js";import{f as m}from"./ModalFooter-BldNwiHO-DEBKMbgd.js";import{C as x}from"./check-DQ_MnRfH.js";import{C as f}from"./copy-D5-3KgRK.js";const v=({address:r,showCopyIcon:i,url:n,className:a})=>{let[s,l]=d.useState(!1);function c(o){o.stopPropagation(),navigator.clipboard.writeText(r).then(()=>l(!0)).catch(console.error)}return d.useEffect(()=>{if(s){let o=setTimeout(()=>l(!1),3e3);return()=>clearTimeout(o)}},[s]),e.jsxs(h,n?{children:[e.jsx(g,{title:r,className:a,href:`${n}/address/${r}`,target:"_blank",children:p(r)}),i&&e.jsx(m,{onClick:c,size:"sm",style:{gap:"0.375rem"},children:e.jsxs(e.Fragment,s?{children:["Copied",e.jsx(x,{size:16})]}:{children:["Copy",e.jsx(f,{size:16})]})})]}:{children:[e.jsx(u,{title:r,className:a,children:p(r)}),i&&e.jsx(m,{onClick:c,size:"sm",style:{gap:"0.375rem",fontSize:"14px"},children:e.jsxs(e.Fragment,s?{children:["Copied",e.jsx(x,{size:14})]}:{children:["Copy",e.jsx(f,{size:14})]})})]})};let h=t.span`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`,u=t.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--privy-color-foreground);
`,g=t.a`
  font-size: 14px;
  color: var(--privy-color-foreground);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;export{v as d};
