import{d9 as h,dc as l,dd as m,ea as u,eb as C,ec as p,e8 as f}from"./index-DMgB8B-w.js";const $=e=>l.jsx("svg",{viewBox:"0 0 50 50",fill:"none",xmlns:"http://www.w3.org/2000/svg",...e,children:l.jsx("rect",{width:"50",height:"50",fill:"black",rx:10,ry:10})});let c=(e,r,t,o,s)=>{for(let i=r;i<r+o;i++)for(let g=t;g<t+s;g++){let n=e==null?void 0:e[g];n&&n[i]&&(n[i]=0)}return e},z=(e,r)=>{let t=u.create(e,{errorCorrectionLevel:r}).modules,o=C(Array.from(t.data),t.size);return o=c(o,0,0,7,7),o=c(o,o.length-7,0,7,7),c(o,0,o.length-7,7,7)},b=({x:e,y:r,cellSize:t,bgColor:o,fgColor:s})=>l.jsx(l.Fragment,{children:[0,1,2].map(i=>l.jsx("circle",{r:t*(7-2*i)/2,cx:e+7*t/2,cy:r+7*t/2,fill:i%2!=0?o:s},`finder-${e}-${r}-${i}`))}),j=({cellSize:e,matrixSize:r,bgColor:t,fgColor:o})=>l.jsx(l.Fragment,{children:[[0,0],[(r-7)*e,0],[0,(r-7)*e]].map(([s,i])=>l.jsx(b,{x:s,y:i,cellSize:e,bgColor:t,fgColor:o},`finder-${s}-${i}`))}),S=({matrix:e,cellSize:r,color:t})=>l.jsx(l.Fragment,{children:e.map((o,s)=>o.map((i,g)=>i?l.jsx("rect",{height:r-.4,width:r-.4,x:s*r+.1*r,y:g*r+.1*r,rx:.5*r,ry:.5*r,fill:t},`cell-${s}-${g}`):l.jsx(f.Fragment,{},`circle-${s}-${g}`)))}),w=({cellSize:e,matrixSize:r,element:t,sizePercentage:o,bgColor:s})=>{if(!t)return l.jsx(l.Fragment,{});let i=r*(o||.14),g=Math.floor(r/2-i/2),n=Math.floor(r/2+i/2);(n-g)%2!=r%2&&(n+=1);let a=(n-g)*e,x=a-.2*a,d=g*e;return l.jsxs(l.Fragment,{children:[l.jsx("rect",{x:g*e,y:g*e,width:a,height:a,fill:s}),l.jsx(t,{x:d+.1*a,y:d+.1*a,height:x,width:x})]})},v=e=>{var i;let r=e.outputSize,t=z(e.url,e.errorCorrectionLevel),o=r/t.length,s=p(2*o,{min:.025*r,max:.036*r});return l.jsxs("svg",{height:e.outputSize,width:e.outputSize,viewBox:`0 0 ${e.outputSize} ${e.outputSize}`,style:{height:"100%",width:"100%",padding:`${s}px`},children:[l.jsx(S,{matrix:t,cellSize:o,color:e.fgColor}),l.jsx(j,{cellSize:o,matrixSize:t.length,fgColor:e.fgColor,bgColor:e.bgColor}),l.jsx(w,{cellSize:o,element:(i=e.logo)==null?void 0:i.element,bgColor:e.bgColor,matrixSize:t.length})]})},y=m.div.attrs({className:"ph-no-capture"})`
  display: flex;
  justify-content: center;
  align-items: center;
  height: ${e=>`${e.$size}px`};
  width: ${e=>`${e.$size}px`};
  margin: auto;
  background-color: ${e=>e.$bgColor};

  && {
    border-width: 2px;
    border-color: ${e=>e.$borderColor};
    border-radius: var(--privy-border-radius-md);
  }
`;const L=e=>{let{appearance:r}=h(),t=e.bgColor||"#FFFFFF",o=e.fgColor||"#000000",s=e.size||160,i=r.palette.colorScheme==="dark"?t:o;return l.jsx(y,{$size:s,$bgColor:t,$fgColor:o,$borderColor:i,children:l.jsx(v,{url:e.url,logo:e.hideLogo?void 0:{element:e.squareLogoElement??$},outputSize:s,bgColor:t,fgColor:o,errorCorrectionLevel:e.errorCorrectionLevel||"Q"})})};export{L as x};
