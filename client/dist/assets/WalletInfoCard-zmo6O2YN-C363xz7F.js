import{da as l,dc as e,dd as r}from"./index-DMgB8B-w.js";import{f as p}from"./ModalFooter-BldNwiHO-DEBKMbgd.js";import{e as f}from"./ErrorMessage-D8VaAP5m-CxtikVb7.js";import{r as x}from"./LabelXs-oqZNqbm_-BpMmjj4p.js";import{d as h}from"./Address-DMC9FYV2-mytqDikj.js";import{d as g}from"./shared-FM0rljBt-DukQZ7YM.js";import{C as j}from"./check-DQ_MnRfH.js";import{C as u}from"./copy-D5-3KgRK.js";let v=r(g)`
  && {
    padding: 0.75rem;
    height: 56px;
  }
`,y=r.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`,C=r.div`
  display: flex;
  flex-direction: column;
  gap: 0;
`,w=r.div`
  font-size: 12px;
  line-height: 1rem;
  color: var(--privy-color-foreground-3);
`,b=r(x)`
  text-align: left;
  margin-bottom: 0.5rem;
`,z=r(f)`
  margin-top: 0.25rem;
`,E=r(p)`
  && {
    gap: 0.375rem;
    font-size: 14px;
  }
`;const P=({errMsg:t,balance:i,address:a,className:c,title:n,showCopyButton:m=!1})=>{let[s,d]=l.useState(!1);return l.useEffect(()=>{if(s){let o=setTimeout(()=>d(!1),3e3);return()=>clearTimeout(o)}},[s]),e.jsxs("div",{children:[n&&e.jsx(b,{children:n}),e.jsx(v,{className:c,$state:t?"error":void 0,children:e.jsxs(y,{children:[e.jsxs(C,{children:[e.jsx(h,{address:a,showCopyIcon:!1}),i!==void 0&&e.jsx(w,{children:i})]}),m&&e.jsx(E,{onClick:function(o){o.stopPropagation(),navigator.clipboard.writeText(a).then(()=>d(!0)).catch(console.error)},size:"sm",children:e.jsxs(e.Fragment,s?{children:["Copied",e.jsx(j,{size:14})]}:{children:["Copy",e.jsx(u,{size:14})]})})]})}),t&&e.jsx(z,{children:t})]})};export{P as j};
