import{da as D,dd as h,de as Ve,dc as e,d9 as xe,gg as he,eI as ne,eu as je,gh as He,gi as Be,ci as Ue,gj as qe}from"./index-DMgB8B-w.js";import{L as X,i as Je,b as K,h as me,w as Qe}from"./ModalFooter-BldNwiHO-DEBKMbgd.js";import{e as n,t as V,s,n as i,a as Xe}from"./Value-DTgR824E-BvZqHDVk.js";import{e as z}from"./ErrorMessage-D8VaAP5m-CxtikVb7.js";import{r as O}from"./LabelXs-oqZNqbm_-BpMmjj4p.js";import{r as ue}from"./Subtitle-CV-2yKE4-QYPmU0JT.js";import{e as pe}from"./Title-BnzYV3Is-CyePfD84.js";import{d as c}from"./Address-DMC9FYV2-mytqDikj.js";import{j as Ke}from"./WalletInfoCard-zmo6O2YN-C363xz7F.js";import{i as ge}from"./LoadingSkeleton-BMsgO5PV-B8ofmYI_.js";import{d as Ye}from"./shared-FM0rljBt-DukQZ7YM.js";import{o as Ze}from"./Checkbox-D1EDeo41-DVNcopMB.js";import{i as _e}from"./ErrorBanner-BcpGRt0h-DTy4lw_1.js";import{t as Ge}from"./WarningBanner-ZZqCEtZK-U3p3kMto.js";import{F as We}from"./ExclamationCircleIcon-BWu4vNF5.js";import{F as fe}from"./ChevronDownIcon-B5nwM4LI.js";function $e({title:l,titleId:a,...o},m){return D.createElement("svg",Object.assign({xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor","aria-hidden":"true","data-slot":"icon",ref:m,"aria-labelledby":a},o),l?D.createElement("title",{id:a},l):null,D.createElement("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z"}))}const er=D.forwardRef($e),ye=h(n)`
  cursor: pointer;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  color: var(--privy-color-accent);
  svg {
    fill: var(--privy-color-accent);
  }
`;var ie=({iconUrl:l,value:a,symbol:o,usdValue:m,nftName:F,nftCount:p,decimals:t,$isLoading:f})=>{if(f)return e.jsx(te,{$isLoading:f});let y=a&&m&&t?function(v,T,I){let b=parseFloat(v),x=parseFloat(I);if(b===0||x===0||Number.isNaN(b)||Number.isNaN(x))return v;let g=Math.ceil(-Math.log10(.01/(x/b))),d=Math.pow(10,g=Math.max(g=Math.min(g,T),1)),w=+(Math.floor(b*d)/d).toFixed(g).replace(/\.?0+$/,"");return Intl.NumberFormat(void 0,{maximumFractionDigits:T}).format(w)}(a,t,m):a;return e.jsxs("div",{children:[e.jsxs(te,{$isLoading:f,children:[l&&e.jsx(sr,{src:l,alt:"Token icon"}),p&&p>1?p+"x":void 0," ",F,y," ",o]}),m&&e.jsxs(rr,{$isLoading:f,children:["$",m]})]})};let te=h.span`
  color: var(--privy-color-foreground);
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.375rem;
  word-break: break-all;
  text-align: right;
  display: flex;
  justify-content: flex-end;

  /**
   * @NOTE This is a code smell anti-pattern for styling components.
   * We are mixing JSX definitions with styled-components CSS definitions.
   * This is not ideal and should be refactored in the future to separate concerns.
   * This is also hard to read, as it makes it difficult to understand the structure
   * of the component and its styles by viewing the JSX.
   */

  ${ge}
`;const rr=h.span`
  color: var(--privy-color-foreground-2);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  word-break: break-all;
  text-align: right;
  display: flex;
  justify-content: flex-end;

  ${ge}
`;let sr=h.img`
  height: 14px;
  width: 14px;
  margin-right: 4px;
  object-fit: contain;
`;const nr=l=>{var f,y,v,T,I,b,x,g;let{chain:a,transactionDetails:o,isTokenContractInfoLoading:m,symbol:F}=l,{action:p,functionName:t}=o;return e.jsx(Ye,{children:e.jsxs(V,{children:[p!=="transaction"&&e.jsxs(s,{children:[e.jsx(n,{children:"Action"}),e.jsx(i,{children:t})]}),t==="mint"&&"args"in o&&o.args.filter(d=>d).map((d,w)=>{var u,S;return e.jsxs(s,{children:[e.jsx(n,{children:`Param ${w}`}),e.jsx(i,{children:typeof d=="string"&&Ue(d)?e.jsx(c,{address:d,url:(S=(u=a==null?void 0:a.blockExplorers)==null?void 0:u.default)==null?void 0:S.url,showCopyIcon:!1}):d==null?void 0:d.toString()})]},w)}),t==="setApprovalForAll"&&o.operator&&e.jsxs(s,{children:[e.jsx(n,{children:"Operator"}),e.jsx(i,{children:e.jsx(c,{address:o.operator,url:(y=(f=a==null?void 0:a.blockExplorers)==null?void 0:f.default)==null?void 0:y.url,showCopyIcon:!1})})]}),t==="setApprovalForAll"&&o.approved!==void 0&&e.jsxs(s,{children:[e.jsx(n,{children:"Set approval to"}),e.jsx(i,{children:o.approved?"true":"false"})]}),t==="transfer"||t==="transferWithMemo"||t==="transferFrom"||t==="safeTransferFrom"||t==="approve"?e.jsxs(e.Fragment,{children:["formattedAmount"in o&&o.formattedAmount&&e.jsxs(s,{children:[e.jsx(n,{children:"Amount"}),e.jsxs(i,{$isLoading:m,children:[o.formattedAmount," ",F]})]}),"tokenId"in o&&o.tokenId&&e.jsxs(s,{children:[e.jsx(n,{children:"Token ID"}),e.jsx(i,{children:o.tokenId.toString()})]})]}):null,t==="safeBatchTransferFrom"&&e.jsxs(e.Fragment,{children:["amounts"in o&&o.amounts&&e.jsxs(s,{children:[e.jsx(n,{children:"Amounts"}),e.jsx(i,{children:o.amounts.join(", ")})]}),"tokenIds"in o&&o.tokenIds&&e.jsxs(s,{children:[e.jsx(n,{children:"Token IDs"}),e.jsx(i,{children:o.tokenIds.join(", ")})]})]}),t==="approve"&&o.spender&&e.jsxs(s,{children:[e.jsx(n,{children:"Spender"}),e.jsx(i,{children:e.jsx(c,{address:o.spender,url:(T=(v=a==null?void 0:a.blockExplorers)==null?void 0:v.default)==null?void 0:T.url,showCopyIcon:!1})})]}),(t==="transferFrom"||t==="safeTransferFrom"||t==="safeBatchTransferFrom")&&o.transferFrom&&e.jsxs(s,{children:[e.jsx(n,{children:"Transferring from"}),e.jsx(i,{children:e.jsx(c,{address:o.transferFrom,url:(b=(I=a==null?void 0:a.blockExplorers)==null?void 0:I.default)==null?void 0:b.url,showCopyIcon:!1})})]}),(t==="transferFrom"||t==="safeTransferFrom"||t==="safeBatchTransferFrom")&&o.transferTo&&e.jsxs(s,{children:[e.jsx(n,{children:"Transferring to"}),e.jsx(i,{children:e.jsx(c,{address:o.transferTo,url:(g=(x=a==null?void 0:a.blockExplorers)==null?void 0:x.default)==null?void 0:g.url,showCopyIcon:!1})})]})]})})},ir=({variant:l,setPreventMaliciousTransaction:a,colorScheme:o="light",preventMaliciousTransaction:m})=>l==="warn"?e.jsx(oe,{children:e.jsxs(Ge,{theme:o,children:[e.jsx("span",{style:{fontWeight:"500"},children:"Warning: Suspicious transaction"}),e.jsx("br",{}),"This has been flagged as a potentially deceptive request. Approving could put your assets or funds at risk."]})}):l==="error"?e.jsx(e.Fragment,{children:e.jsxs(oe,{children:[e.jsx(_e,{theme:o,children:e.jsxs("div",{children:[e.jsx("strong",{children:"This is a malicious transaction"}),e.jsx("br",{}),"This transaction transfers tokens to a known malicious address. Proceeding may result in the loss of valuable assets."]})}),e.jsxs(tr,{children:[e.jsx(Ze,{color:"var(--privy-color-error)",checked:!m,readOnly:!0,onClick:()=>a(!m)}),e.jsx("span",{children:"I understand and want to proceed anyways."})]})]})}):null;let oe=h.div`
  margin-top: 1.5rem;
`,tr=h.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
`;const or=({transactionIndex:l,maxIndex:a})=>typeof l!="number"||a===0?"":` (${l+1} / ${a+1})`,Mr=({img:l,submitError:a,prepareError:o,onClose:m,action:F,title:p,subtitle:t,to:f,tokenAddress:y,network:v,missingFunds:T,fee:I,from:b,cta:x,disabled:g,chain:d,isSubmitting:w,isPreparing:u,isTokenPriceLoading:S,isTokenContractInfoLoading:E,isSponsored:L,symbol:H,balance:P,onClick:N,transactionDetails:A,transactionIndex:R,maxIndex:B,onBack:r,chainName:k,validation:U,hasScanDetails:Y,setIsScanDetailsOpen:Ie,preventMaliciousTransaction:Se,setPreventMaliciousTransaction:Ae,tokensSent:Z,tokensReceived:q,isScanning:Ce,isCancellable:Fe,functionName:Oe})=>{var _,G,W,$,ee,re;let{showTransactionDetails:J,setShowTransactionDetails:Ee,hasMoreDetails:Ne,isErc20Ish:De}=(j=>{let[M,Pe]=D.useState(!1),Q=!0,se=!1;return(!j||j.isErc20Ish||j.action==="transaction")&&(Q=!1),Q&&(se=Object.entries(j||{}).some(([Re,ze])=>ze&&!["action","isErc20Ish","isNFTIsh"].includes(Re))),{showTransactionDetails:M,setShowTransactionDetails:Pe,hasMoreDetails:Q&&se,isErc20Ish:j==null?void 0:j.isErc20Ish}})(A),Le=xe(),Me=De&&E||u||S||Ce;return e.jsxs(e.Fragment,{children:[e.jsx(X,{onClose:m,backFn:r}),l&&e.jsx(be,{children:l}),e.jsxs(pe,{style:{marginTop:l?"1.5rem":0},children:[p,e.jsx(or,{maxIndex:B,transactionIndex:R})]}),e.jsx(ue,{children:t}),e.jsxs(V,{style:{marginTop:"2rem"},children:[(!!Z[0]||Me)&&e.jsxs(s,{children:[q.length>0?e.jsx(n,{children:"Send"}):e.jsx(n,{children:F==="approve"?"Approval amount":"Amount"}),e.jsx("div",{className:"flex flex-col",children:Z.map((j,M)=>e.jsx(ie,{iconUrl:j.iconUrl,value:Oe==="setApprovalForAll"?"All":j.value,usdValue:j.usdValue,symbol:j.symbol,nftName:j.nftName,nftCount:j.nftCount,decimals:j.decimals},M))})]}),q.length>0&&e.jsxs(s,{children:[e.jsx(n,{children:"Receive"}),e.jsx("div",{className:"flex flex-col",children:q.map((j,M)=>e.jsx(ie,{iconUrl:j.iconUrl,value:j.value,usdValue:j.usdValue,symbol:j.symbol,nftName:j.nftName,nftCount:j.nftCount,decimals:j.decimals},M))})]}),A&&"spender"in A&&(A!=null&&A.spender)?e.jsxs(s,{children:[e.jsx(n,{children:"Spender"}),e.jsx(i,{children:e.jsx(c,{address:A.spender,url:(G=(_=d==null?void 0:d.blockExplorers)==null?void 0:_.default)==null?void 0:G.url})})]}):null,f&&e.jsxs(s,{children:[e.jsx(n,{children:"To"}),e.jsx(i,{children:e.jsx(c,{address:f,url:($=(W=d==null?void 0:d.blockExplorers)==null?void 0:W.default)==null?void 0:$.url,showCopyIcon:!0})})]}),y&&e.jsxs(s,{children:[e.jsx(n,{children:"Token address"}),e.jsx(i,{children:e.jsx(c,{address:y,url:(re=(ee=d==null?void 0:d.blockExplorers)==null?void 0:ee.default)==null?void 0:re.url})})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Network"}),e.jsx(i,{children:v})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Estimated fee"}),e.jsx(i,{$isLoading:u||S||L===void 0,children:L?e.jsxs(we,{children:[e.jsxs(Te,{children:["Sponsored by ",Le.name]}),e.jsx(he,{height:16,width:16})]}):I})]}),Ne&&!Y&&e.jsxs(e.Fragment,{children:[e.jsx(s,{className:"cursor-pointer",onClick:()=>Ee(!J),children:e.jsxs(Xe,{className:"flex items-center gap-x-1",children:["Details"," ",e.jsx(fe,{style:{width:"0.75rem",marginLeft:"0.25rem",transform:J?"rotate(180deg)":void 0}})]})}),J&&A&&e.jsx(nr,{action:F,chain:d,transactionDetails:A,isTokenContractInfoLoading:E,symbol:H})]}),Y&&e.jsx(s,{children:e.jsxs(ye,{onClick:()=>Ie(!0),children:[e.jsx("span",{className:"text-color-primary",children:"Details"}),e.jsx(He,{height:"14px",width:"14px",strokeWidth:"2"})]})})]}),e.jsx(je,{}),a?e.jsx(z,{style:{marginTop:"2rem"},children:a.message}):o&&R===0?e.jsx(z,{style:{marginTop:"2rem"},children:o.shortMessage??ve}):null,e.jsx(ir,{variant:U,preventMaliciousTransaction:Se,setPreventMaliciousTransaction:Ae}),e.jsx(ke,{$useSmallMargins:!(!o&&!a&&U!=="warn"&&U!=="error"),address:b,balance:P,errMsg:u||o||a||!T?void 0:`Add funds on ${(d==null?void 0:d.name)??k} to complete transaction.`}),e.jsx(K,{style:{marginTop:"1rem"},loading:w,disabled:g||u,onClick:N,children:x}),Fe&&e.jsx(Qe,{style:{marginTop:"1rem"},onClick:m,isSubmitting:!1,children:"Not now"}),e.jsx(me,{})]})},Pr=({img:l,title:a,subtitle:o,cta:m,instructions:F,network:p,blockExplorerUrl:t,isMissingFunds:f,submitError:y,parseError:v,total:T,swap:I,transactingWalletAddress:b,fee:x,balance:g,disabled:d,isSubmitting:w,isPreparing:u,isTokenPriceLoading:S,onClick:E,onClose:L,onBack:H,isSponsored:P})=>{let N=u||S,[A,R]=D.useState(!1),B=xe();return e.jsxs(e.Fragment,{children:[e.jsx(X,{onClose:L,backFn:H}),l&&e.jsx(be,{children:l}),e.jsx(pe,{style:{marginTop:l?"1.5rem":0},children:a}),e.jsx(ue,{children:o}),e.jsxs(V,{style:{marginTop:"2rem",marginBottom:".5rem"},children:[(T||N)&&e.jsxs(s,{children:[e.jsx(n,{children:"Amount"}),e.jsx(i,{$isLoading:N,children:T})]}),I&&e.jsxs(s,{children:[e.jsx(n,{children:"Swap"}),e.jsx(i,{children:I})]}),p&&e.jsxs(s,{children:[e.jsx(n,{children:"Network"}),e.jsx(i,{children:p})]}),(x||N||P!==void 0)&&e.jsxs(s,{children:[e.jsx(n,{children:"Estimated fee"}),e.jsx(i,{$isLoading:N,children:P&&!N?e.jsxs(we,{children:[e.jsxs(Te,{children:["Sponsored by ",B.name]}),e.jsx(he,{height:16,width:16})]}):x})]})]}),e.jsx(s,{children:e.jsxs(ye,{onClick:()=>R(r=>!r),children:[e.jsx("span",{children:"Advanced"}),e.jsx(fe,{height:"16px",width:"16px",strokeWidth:"2",style:{transition:"all 300ms",transform:A?"rotate(180deg)":void 0}})]})}),A&&e.jsx(e.Fragment,{children:F.map((r,k)=>r.type==="sol-transfer"?e.jsxs(C,{children:[e.jsx(s,{children:e.jsxs(O,{children:["Transfer ",r.withSeed?"with seed":""]})}),e.jsxs(s,{children:[e.jsx(n,{children:"Amount"}),e.jsxs(i,{children:[ne({amount:r.value,decimals:r.token.decimals})," ",r.token.symbol]})]}),!!r.toAccount&&e.jsxs(s,{children:[e.jsx(n,{children:"Destination"}),e.jsx(i,{children:e.jsx(c,{address:r.toAccount,url:t})})]})]},k):r.type==="spl-transfer"?e.jsxs(C,{children:[e.jsx(s,{children:e.jsxs(O,{children:["Transfer ",r.token.symbol]})}),e.jsxs(s,{children:[e.jsx(n,{children:"Amount"}),e.jsx(i,{children:r.value.toString()})]}),!!r.fromAta&&e.jsxs(s,{children:[e.jsx(n,{children:"Source"}),e.jsx(i,{children:e.jsx(c,{address:r.fromAta,url:t})})]}),!!r.toAta&&e.jsxs(s,{children:[e.jsx(n,{children:"Destination"}),e.jsx(i,{children:e.jsx(c,{address:r.toAta,url:t})})]}),!!r.token.address&&e.jsxs(s,{children:[e.jsx(n,{children:"Token"}),e.jsx(i,{children:e.jsx(c,{address:r.token.address,url:t})})]})]},k):r.type==="ata-creation"?e.jsxs(C,{children:[e.jsx(s,{children:e.jsx(O,{children:"Create token account"})}),e.jsxs(s,{children:[e.jsx(n,{children:"Program ID"}),e.jsx(i,{children:e.jsx(c,{address:r.program,url:t})})]}),!!r.owner&&e.jsxs(s,{children:[e.jsx(n,{children:"Owner"}),e.jsx(i,{children:e.jsx(c,{address:r.owner,url:t})})]})]},k):r.type==="create-account"?e.jsxs(C,{children:[e.jsx(s,{children:e.jsxs(O,{children:["Create account ",r.withSeed?"with seed":""]})}),!!r.account&&e.jsxs(s,{children:[e.jsx(n,{children:"Account"}),e.jsx(i,{children:e.jsx(c,{address:r.account,url:t})})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Amount"}),e.jsxs(i,{children:[ne({amount:r.value,decimals:9})," SOL"]})]})]},k):r.type==="spl-init-account"?e.jsxs(C,{children:[e.jsx(s,{children:e.jsx(O,{children:"Initialize token account"})}),!!r.account&&e.jsxs(s,{children:[e.jsx(n,{children:"Account"}),e.jsx(i,{children:e.jsx(c,{address:r.account,url:t})})]}),!!r.mint&&e.jsxs(s,{children:[e.jsx(n,{children:"Mint"}),e.jsx(i,{children:e.jsx(c,{address:r.mint,url:t})})]}),!!r.owner&&e.jsxs(s,{children:[e.jsx(n,{children:"Owner"}),e.jsx(i,{children:e.jsx(c,{address:r.owner,url:t})})]})]},k):r.type==="spl-close-account"?e.jsxs(C,{children:[e.jsx(s,{children:e.jsx(O,{children:"Close token account"})}),!!r.source&&e.jsxs(s,{children:[e.jsx(n,{children:"Source"}),e.jsx(i,{children:e.jsx(c,{address:r.source,url:t})})]}),!!r.destination&&e.jsxs(s,{children:[e.jsx(n,{children:"Destination"}),e.jsx(i,{children:e.jsx(c,{address:r.destination,url:t})})]}),!!r.owner&&e.jsxs(s,{children:[e.jsx(n,{children:"Owner"}),e.jsx(i,{children:e.jsx(c,{address:r.owner,url:t})})]})]},k):r.type==="spl-sync-native"?e.jsxs(C,{children:[e.jsx(s,{children:e.jsx(O,{children:"Sync native"})}),e.jsxs(s,{children:[e.jsx(n,{children:"Program ID"}),e.jsx(i,{children:e.jsx(c,{address:r.program,url:t})})]})]},k):r.type==="raydium-swap-base-input"?e.jsxs(C,{children:[e.jsx(s,{children:e.jsxs(O,{children:["Raydium swap"," ",r.tokenIn&&r.tokenOut?`${r.tokenIn.symbol} → ${r.tokenOut.symbol}`:""]})}),e.jsxs(s,{children:[e.jsx(n,{children:"Amount in"}),e.jsx(i,{children:r.amountIn.toString()})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Minimum amount out"}),e.jsx(i,{children:r.minimumAmountOut.toString()})]}),r.mintIn&&e.jsxs(s,{children:[e.jsx(n,{children:"Token in"}),e.jsx(i,{children:e.jsx(c,{address:r.mintIn,url:t})})]}),r.mintOut&&e.jsxs(s,{children:[e.jsx(n,{children:"Token out"}),e.jsx(i,{children:e.jsx(c,{address:r.mintOut,url:t})})]})]},k):r.type==="raydium-swap-base-output"?e.jsxs(C,{children:[e.jsx(s,{children:e.jsxs(O,{children:["Raydium swap"," ",r.tokenIn&&r.tokenOut?`${r.tokenIn.symbol} → ${r.tokenOut.symbol}`:""]})}),e.jsxs(s,{children:[e.jsx(n,{children:"Max amount in"}),e.jsx(i,{children:r.maxAmountIn.toString()})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Amount out"}),e.jsx(i,{children:r.amountOut.toString()})]}),r.mintIn&&e.jsxs(s,{children:[e.jsx(n,{children:"Token in"}),e.jsx(i,{children:e.jsx(c,{address:r.mintIn,url:t})})]}),r.mintOut&&e.jsxs(s,{children:[e.jsx(n,{children:"Token out"}),e.jsx(i,{children:e.jsx(c,{address:r.mintOut,url:t})})]})]},k):r.type==="jupiter-swap-shared-accounts-route"?e.jsxs(C,{children:[e.jsx(s,{children:e.jsxs(O,{children:["Jupiter swap"," ",r.tokenIn&&r.tokenOut?`${r.tokenIn.symbol} → ${r.tokenOut.symbol}`:""]})}),e.jsxs(s,{children:[e.jsx(n,{children:"In amount"}),e.jsx(i,{children:r.inAmount.toString()})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Quoted out amount"}),e.jsx(i,{children:r.quotedOutAmount.toString()})]}),r.mintIn&&e.jsxs(s,{children:[e.jsx(n,{children:"Token in"}),e.jsx(i,{children:e.jsx(c,{address:r.mintIn,url:t})})]}),r.mintOut&&e.jsxs(s,{children:[e.jsx(n,{children:"Token out"}),e.jsx(i,{children:e.jsx(c,{address:r.mintOut,url:t})})]})]},k):r.type==="jupiter-swap-exact-out-route"?e.jsxs(C,{children:[e.jsx(s,{children:e.jsxs(O,{children:["Jupiter swap"," ",r.tokenIn&&r.tokenOut?`${r.tokenIn.symbol} → ${r.tokenOut.symbol}`:""]})}),e.jsxs(s,{children:[e.jsx(n,{children:"Quoted in amount"}),e.jsx(i,{children:r.quotedInAmount.toString()})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Amount out"}),e.jsx(i,{children:r.outAmount.toString()})]}),r.mintIn&&e.jsxs(s,{children:[e.jsx(n,{children:"Token in"}),e.jsx(i,{children:e.jsx(c,{address:r.mintIn,url:t})})]}),r.mintOut&&e.jsxs(s,{children:[e.jsx(n,{children:"Token out"}),e.jsx(i,{children:e.jsx(c,{address:r.mintOut,url:t})})]})]},k):e.jsxs(C,{children:[e.jsxs(s,{children:[e.jsx(n,{children:"Program ID"}),e.jsx(i,{children:e.jsx(c,{address:r.program,url:t})})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Data"}),e.jsx(i,{children:r.discriminator})]})]},k))}),e.jsx(je,{}),y?e.jsx(z,{style:{marginTop:"2rem"},children:y.message}):v?e.jsx(z,{style:{marginTop:"2rem"},children:ve}):null,e.jsx(ke,{$useSmallMargins:!(!v&&!y),title:"",address:b,balance:g,errMsg:u||v||y||!f?void 0:"Add funds on Solana to complete transaction."}),e.jsx(K,{style:{marginTop:"1rem"},loading:w,disabled:d||u,onClick:E,children:m}),e.jsx(me,{})]})};let ke=h(Ke)`
  ${l=>l.$useSmallMargins?"margin-top: 0.5rem;":"margin-top: 2rem;"}
`,C=h(V)`
  margin-top: 0.5rem;
  border: 1px solid var(--privy-color-foreground-4);
  border-radius: var(--privy-border-radius-sm);
  padding: 0.5rem;
`,ve="There was an error preparing your transaction. Your transaction request will likely fail.",be=h.div`
  display: flex;
  width: 100%;
  justify-content: center;
  max-height: 40px;

  > img {
    object-fit: contain;
    border-radius: var(--privy-border-radius-sm);
  }
`,we=h.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
`,Te=h.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--privy-color-foreground);
`,ae=l=>(l==null?void 0:l.code)===Be.COMPLIANCE_BLOCKED,ar=()=>e.jsxs(xr,{children:[e.jsx(jr,{}),e.jsx(hr,{})]});const Rr=({transactionError:l,chainId:a,onClose:o,onRetry:m,chainType:F,transactionHash:p})=>{let{chains:t}=Ve(),[f,y]=D.useState(!1),{errorCode:v,errorMessage:T}=((x,g)=>{if(g==="ethereum")return ae(x)?{errorCode:"Transaction blocked",errorMessage:x.message}:{errorCode:x.details??x.message,errorMessage:x.shortMessage};let d=x.txSignature,w=(x==null?void 0:x.transactionMessage)||"Something went wrong.";if(Array.isArray(x.logs)){let u=x.logs.find(S=>/insufficient (lamports|funds)/gi.test(S));u&&(w=u)}return{transactionHash:d,errorMessage:w}})(l,F),I=ae(l),b=(({chains:x,chainId:g,chainType:d,transactionHash:w})=>{var u,S;return d==="ethereum"?((S=(u=x.find(E=>E.id===g))==null?void 0:u.blockExplorers)==null?void 0:S.default.url)??"https://etherscan.io":function(E,L){return`https://explorer.solana.com/tx/${E}?chain=${L}`}(w||"",g)})({chains:t,chainId:a,chainType:F,transactionHash:p});return e.jsxs(e.Fragment,{children:[e.jsx(X,{onClose:o}),e.jsxs(lr,{children:[e.jsx(ar,{}),e.jsx(dr,{children:v}),e.jsx(cr,{children:I?"This transaction cannot be completed.":"Please try again."}),e.jsxs(de,{children:[e.jsx(le,{children:"Error message"}),e.jsx(ce,{$clickable:!1,children:T})]}),p&&e.jsxs(de,{children:[e.jsx(le,{children:"Transaction hash"}),e.jsxs(ur,{children:["Copy this hash to view details about the transaction on a"," ",e.jsx("u",{children:e.jsx("a",{href:b,children:"block explorer"})}),"."]}),e.jsxs(ce,{$clickable:!0,onClick:async()=>{await navigator.clipboard.writeText(p),y(!0)},children:[p,e.jsx(fr,{clicked:f})]})]}),!I&&e.jsx(mr,{onClick:()=>m({resetNonce:!!p}),children:"Retry transaction"})]}),e.jsx(Je,{})]})};let lr=h.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`,dr=h.span`
  color: var(--privy-color-foreground);
  font-size: 1.125rem;
  font-weight: 500;
  line-height: 1.25rem; /* 111.111% */
  text-align: center;
  margin: 10px;
`,cr=h.span`
  margin-top: 4px;
  margin-bottom: 10px;
  color: var(--privy-color-foreground-3);
  text-align: center;

  font-size: 0.875rem;
  font-style: normal;
  font-weight: 400;
  line-height: 20px; /* 142.857% */
  letter-spacing: -0.008px;
`,xr=h.div`
  position: relative;
  width: 60px;
  height: 60px;
  margin: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
`,hr=h(We)`
  position: absolute;
  width: 35px;
  height: 35px;
  color: var(--privy-color-error);
`,jr=h.div`
  position: absolute;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: var(--privy-color-error);
  opacity: 0.1;
`,mr=h(K)`
  && {
    margin-top: 24px;
  }
  transition:
    color 350ms ease,
    background-color 350ms ease;
`,le=h.span`
  width: 100%;
  text-align: left;
  font-size: 0.825rem;
  color: var(--privy-color-foreground);
  padding: 4px;
`,de=h.div`
  width: 100%;
  margin: 5px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`,ur=h.text`
  position: relative;
  width: 100%;
  padding: 5px;
  font-size: 0.8rem;
  color: var(--privy-color-foreground-3);
  text-align: left;
  overflow-wrap: break-word;
`,ce=h.span`
  position: relative;
  width: 100%;
  background-color: var(--privy-color-background-2);
  padding: 8px 12px;
  border-radius: 10px;
  margin-top: 5px;
  font-size: 14px;
  color: var(--privy-color-foreground-3);
  text-align: left;
  overflow-wrap: break-word;
  ${l=>l.$clickable&&`cursor: pointer;
  transition: background-color 0.3s;
  padding-right: 45px;

  &:hover {
    background-color: var(--privy-color-foreground-4);
  }`}
`,pr=h(er)`
  position: absolute;
  top: 13px;
  right: 13px;
  width: 24px;
  height: 24px;
`,gr=h(qe)`
  position: absolute;
  top: 13px;
  right: 13px;
  width: 24px;
  height: 24px;
`,fr=({clicked:l})=>e.jsx(l?gr:pr,{});export{Pr as G,Mr as Q,Rr as o};
