import{dc as r,dd as i}from"./index-DMgB8B-w.js";const p=({className:e,checked:o,color:s="var(--privy-color-accent)",...c})=>r.jsx("label",{children:r.jsxs(t,{className:e,children:[r.jsx(l,{checked:o,...c}),r.jsx(a,{color:s,checked:o,children:r.jsx(d,{viewBox:"0 0 24 24",children:r.jsx("polyline",{points:"20 6 9 17 4 12"})})})]})});i.label`
  && {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    text-align: left;
    border-radius: 0.5rem;
    border: 1px solid var(--privy-color-foreground-4);
    width: 100%;
  }
`;let t=i.div`
  display: inline-block;
  vertical-align: middle;
`,d=i.svg`
  fill: none;
  stroke: white;
  stroke-width: 3px;
`,l=i.input.attrs({type:"checkbox"})`
  border: 0;
  clip-path: inset(50%);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;
`,a=i.div`
  display: inline-block;
  width: 18px;
  height: 18px;
  transition: all 150ms;
  cursor: pointer;
  border-color: ${e=>e.color};
  border-radius: 3px;
  background: ${e=>e.checked?e.color:"var(--privy-color-background)"};

  && {
    /* This is necessary to override css reset for border width */
    border-width: 1px;
  }

  ${l}:focus + & {
    box-shadow: 0 0 0 1px ${e=>e.color};
  }

  ${d} {
    visibility: ${e=>e.checked?"visible":"hidden"};
  }
`;export{p as o};
