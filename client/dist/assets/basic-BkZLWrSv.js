import{x as k,o as D,A as T,O as N,i as R,e as _,a as qe,y as d,E as O,R as E,u as B,G as Ot,X as me,F as he,Y as xn,v as j,z as ae,T as $t,d as Oe,M as Gt,Z as Yt,_ as Jt,m as Qt,U as Pe,C as de,$ as En,a0 as Rn,Q as Mt,I as Xt,a1 as vt}from"./core-BO6wT8km.js";import{n as u,r as C,c as S,o as A,U as oe,i as _n,t as Tn,e as Sn}from"./index-C4Y_q8Kw.js";import{i0 as In}from"./index-DMgB8B-w.js";var Ae=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let we=class extends k{constructor(){super(),this.unsubscribe=[],this.tabIdx=void 0,this.connectors=D.state.connectors,this.count=T.state.count,this.filteredCount=T.state.filteredWallets.length,this.isFetchingRecommendedWallets=T.state.isFetchingRecommendedWallets,this.unsubscribe.push(D.subscribeKey("connectors",t=>this.connectors=t),T.subscribeKey("count",t=>this.count=t),T.subscribeKey("filteredWallets",t=>this.filteredCount=t.length),T.subscribeKey("isFetchingRecommendedWallets",t=>this.isFetchingRecommendedWallets=t))}disconnectedCallback(){this.unsubscribe.forEach(t=>t())}render(){const t=this.connectors.find(c=>c.id==="walletConnect"),{allWallets:n}=N.state;if(!t||n==="HIDE"||n==="ONLY_MOBILE"&&!R.isMobile())return null;const o=T.state.featured.length,r=this.count+o,i=r<10?r:Math.floor(r/10)*10,s=this.filteredCount>0?this.filteredCount:i;let a=`${s}`;this.filteredCount>0?a=`${this.filteredCount}`:s<r&&(a=`${s}+`);const l=_.hasAnyConnection(qe.CONNECTOR_ID.WALLET_CONNECT);return d`
      <wui-list-wallet
        name="Search Wallet"
        walletIcon="search"
        showAllWallets
        @click=${this.onAllWallets.bind(this)}
        tagLabel=${a}
        tagVariant="info"
        data-testid="all-wallets"
        tabIdx=${A(this.tabIdx)}
        .loading=${this.isFetchingRecommendedWallets}
        ?disabled=${l}
        size="sm"
      ></wui-list-wallet>
    `}onAllWallets(){var t;O.sendEvent({type:"track",event:"CLICK_ALL_WALLETS"}),E.push("AllWallets",{redirectView:(t=E.state.data)==null?void 0:t.redirectView})}};Ae([u()],we.prototype,"tabIdx",void 0);Ae([C()],we.prototype,"connectors",void 0);Ae([C()],we.prototype,"count",void 0);Ae([C()],we.prototype,"filteredCount",void 0);Ae([C()],we.prototype,"isFetchingRecommendedWallets",void 0);we=Ae([S("w3m-all-wallets-widget")],we);const kn=B`
  :host {
    margin-top: ${({spacing:e})=>e[1]};
  }
  wui-separator {
    margin: ${({spacing:e})=>e[3]} calc(${({spacing:e})=>e[3]} * -1)
      ${({spacing:e})=>e[2]} calc(${({spacing:e})=>e[3]} * -1);
    width: calc(100% + ${({spacing:e})=>e[3]} * 2);
  }
`;var le=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let G=class extends k{constructor(){super(),this.unsubscribe=[],this.connectors=D.state.connectors,this.recommended=T.state.recommended,this.featured=T.state.featured,this.explorerWallets=T.state.explorerWallets,this.connections=_.state.connections,this.connectorImages=Ot.state.connectorImages,this.loadingTelegram=!1,this.unsubscribe.push(D.subscribeKey("connectors",t=>this.connectors=t),_.subscribeKey("connections",t=>this.connections=t),Ot.subscribeKey("connectorImages",t=>this.connectorImages=t),T.subscribeKey("recommended",t=>this.recommended=t),T.subscribeKey("featured",t=>this.featured=t),T.subscribeKey("explorerFilteredWallets",t=>{this.explorerWallets=t!=null&&t.length?t:T.state.explorerWallets}),T.subscribeKey("explorerWallets",t=>{var n;(n=this.explorerWallets)!=null&&n.length||(this.explorerWallets=t)})),R.isTelegram()&&R.isIos()&&(this.loadingTelegram=!_.state.wcUri,this.unsubscribe.push(_.subscribeKey("wcUri",t=>this.loadingTelegram=!t)))}disconnectedCallback(){this.unsubscribe.forEach(t=>t())}render(){return d`
      <wui-flex flexDirection="column" gap="2"> ${this.connectorListTemplate()} </wui-flex>
    `}mapConnectorsToExplorerWallets(t,n){return t.map(o=>{if(o.type==="MULTI_CHAIN"&&o.connectors){const i=o.connectors.map(c=>c.id),s=o.connectors.map(c=>c.name),a=o.connectors.map(c=>{var g;return(g=c.info)==null?void 0:g.rdns}),l=n==null?void 0:n.find(c=>i.includes(c.id)||s.includes(c.name)||c.rdns&&(a.includes(c.rdns)||i.includes(c.rdns)));return o.explorerWallet=l??o.explorerWallet,o}const r=n==null?void 0:n.find(i=>{var s;return i.id===o.id||i.rdns===((s=o.info)==null?void 0:s.rdns)||i.name===o.name});return o.explorerWallet=r??o.explorerWallet,o})}processConnectorsByType(t,n=!0){const o=me.sortConnectorsByExplorerWallet([...t]);return n?o.filter(me.showConnector):o}connectorListTemplate(){const t=this.mapConnectorsToExplorerWallets(this.connectors,this.explorerWallets??[]),n=me.getConnectorsByType(t,this.recommended,this.featured),o=this.processConnectorsByType(n.announced.filter(h=>h.id!=="walletConnect")),r=this.processConnectorsByType(n.injected),i=this.processConnectorsByType(n.multiChain.filter(h=>h.name!=="WalletConnect"),!1),s=n.custom,a=n.recent,l=this.processConnectorsByType(n.external.filter(h=>h.id!==qe.CONNECTOR_ID.COINBASE_SDK)),c=n.recommended,g=n.featured,I=me.getConnectorTypeOrder({custom:s,recent:a,announced:o,injected:r,multiChain:i,recommended:c,featured:g,external:l}),v=this.connectors.find(h=>h.id==="walletConnect"),y=R.isMobile(),$=[];for(const h of I)switch(h){case"walletConnect":{!y&&v&&$.push({kind:"connector",subtype:"walletConnect",connector:v});break}case"recent":{me.getFilteredRecentWallets().forEach(f=>$.push({kind:"wallet",subtype:"recent",wallet:f}));break}case"injected":{i.forEach(b=>$.push({kind:"connector",subtype:"multiChain",connector:b})),o.forEach(b=>$.push({kind:"connector",subtype:"announced",connector:b})),r.forEach(b=>$.push({kind:"connector",subtype:"injected",connector:b}));break}case"featured":{g.forEach(b=>$.push({kind:"wallet",subtype:"featured",wallet:b}));break}case"custom":{me.getFilteredCustomWallets(s??[]).forEach(f=>$.push({kind:"wallet",subtype:"custom",wallet:f}));break}case"external":{l.forEach(b=>$.push({kind:"connector",subtype:"external",connector:b}));break}case"recommended":{me.getCappedRecommendedWallets(c).forEach(f=>$.push({kind:"wallet",subtype:"recommended",wallet:f}));break}default:console.warn(`Unknown connector type: ${h}`)}return $.map((h,b)=>h.kind==="connector"?this.renderConnector(h,b):this.renderWallet(h,b))}renderConnector(t,n){var I,v;const o=t.connector,r=he.getConnectorImage(o)||this.connectorImages[(o==null?void 0:o.imageId)??""],s=(this.connections.get(o.chain)??[]).some(y=>xn.isLowerCaseMatch(y.connectorId,o.id));let a,l;t.subtype==="multiChain"?(a="multichain",l="info"):t.subtype==="walletConnect"?(a="qr code",l="accent"):t.subtype==="injected"||t.subtype==="announced"?(a=s?"connected":"installed",l=s?"info":"success"):(a=void 0,l=void 0);const c=_.hasAnyConnection(qe.CONNECTOR_ID.WALLET_CONNECT),g=t.subtype==="walletConnect"||t.subtype==="external"?c:!1;return d`
      <w3m-list-wallet
        displayIndex=${n}
        imageSrc=${A(r)}
        .installed=${!0}
        name=${o.name??"Unknown"}
        .tagVariant=${l}
        tagLabel=${A(a)}
        data-testid=${`wallet-selector-${o.id.toLowerCase()}`}
        size="sm"
        @click=${()=>this.onClickConnector(t)}
        tabIdx=${A(this.tabIdx)}
        ?disabled=${g}
        rdnsId=${A(((I=o.explorerWallet)==null?void 0:I.rdns)||void 0)}
        walletRank=${A((v=o.explorerWallet)==null?void 0:v.order)}
      >
      </w3m-list-wallet>
    `}onClickConnector(t){var o;const n=(o=E.state.data)==null?void 0:o.redirectView;if(t.subtype==="walletConnect"){D.setActiveConnector(t.connector),R.isMobile()?E.push("AllWallets"):E.push("ConnectingWalletConnect",{redirectView:n});return}if(t.subtype==="multiChain"){D.setActiveConnector(t.connector),E.push("ConnectingMultiChain",{redirectView:n});return}if(t.subtype==="injected"){D.setActiveConnector(t.connector),E.push("ConnectingExternal",{connector:t.connector,redirectView:n,wallet:t.connector.explorerWallet});return}if(t.subtype==="announced"){if(t.connector.id==="walletConnect"){R.isMobile()?E.push("AllWallets"):E.push("ConnectingWalletConnect",{redirectView:n});return}E.push("ConnectingExternal",{connector:t.connector,redirectView:n,wallet:t.connector.explorerWallet});return}E.push("ConnectingExternal",{connector:t.connector,redirectView:n})}renderWallet(t,n){const o=t.wallet,r=he.getWalletImage(o),s=_.hasAnyConnection(qe.CONNECTOR_ID.WALLET_CONNECT),a=this.loadingTelegram,l=t.subtype==="recent"?"recent":void 0,c=t.subtype==="recent"?"info":void 0;return d`
      <w3m-list-wallet
        displayIndex=${n}
        imageSrc=${A(r)}
        name=${o.name??"Unknown"}
        @click=${()=>this.onClickWallet(t)}
        size="sm"
        data-testid=${`wallet-selector-${o.id}`}
        tabIdx=${A(this.tabIdx)}
        ?loading=${a}
        ?disabled=${s}
        rdnsId=${A(o.rdns||void 0)}
        walletRank=${A(o.order)}
        tagLabel=${A(l)}
        .tagVariant=${c}
      >
      </w3m-list-wallet>
    `}onClickWallet(t){var r;const n=(r=E.state.data)==null?void 0:r.redirectView;if(t.subtype==="featured"){D.selectWalletConnector(t.wallet);return}if(t.subtype==="recent"){if(this.loadingTelegram)return;D.selectWalletConnector(t.wallet);return}if(t.subtype==="custom"){if(this.loadingTelegram)return;E.push("ConnectingWalletConnect",{wallet:t.wallet,redirectView:n});return}if(this.loadingTelegram)return;const o=D.getConnector({id:t.wallet.id,rdns:t.wallet.rdns});o?E.push("ConnectingExternal",{connector:o,redirectView:n}):E.push("ConnectingWalletConnect",{wallet:t.wallet,redirectView:n})}};G.styles=kn;le([u({type:Number})],G.prototype,"tabIdx",void 0);le([C()],G.prototype,"connectors",void 0);le([C()],G.prototype,"recommended",void 0);le([C()],G.prototype,"featured",void 0);le([C()],G.prototype,"explorerWallets",void 0);le([C()],G.prototype,"connections",void 0);le([C()],G.prototype,"connectorImages",void 0);le([C()],G.prototype,"loadingTelegram",void 0);G=le([S("w3m-connector-list")],G);const An=B`
  :host {
    flex: 1;
    height: 100%;
  }

  button {
    width: 100%;
    height: 100%;
    display: inline-flex;
    align-items: center;
    padding: ${({spacing:e})=>e[1]} ${({spacing:e})=>e[2]};
    column-gap: ${({spacing:e})=>e[1]};
    color: ${({tokens:e})=>e.theme.textSecondary};
    border-radius: ${({borderRadius:e})=>e[20]};
    background-color: transparent;
    transition: background-color ${({durations:e})=>e.lg}
      ${({easings:e})=>e["ease-out-power-2"]};
    will-change: background-color;
  }

  /* -- Hover & Active states ----------------------------------------------------------- */
  button[data-active='true'] {
    color: ${({tokens:e})=>e.theme.textPrimary};
    background-color: ${({tokens:e})=>e.theme.foregroundTertiary};
  }

  button:hover:enabled:not([data-active='true']),
  button:active:enabled:not([data-active='true']) {
    wui-text,
    wui-icon {
      color: ${({tokens:e})=>e.theme.textPrimary};
    }
  }
`;var ze=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};const Wn={lg:"lg-regular",md:"md-regular",sm:"sm-regular"},Bn={lg:"md",md:"sm",sm:"sm"};let be=class extends k{constructor(){super(...arguments),this.icon="mobile",this.size="md",this.label="",this.active=!1}render(){return d`
      <button data-active=${this.active}>
        ${this.icon?d`<wui-icon size=${Bn[this.size]} name=${this.icon}></wui-icon>`:""}
        <wui-text variant=${Wn[this.size]}> ${this.label} </wui-text>
      </button>
    `}};be.styles=[j,ae,An];ze([u()],be.prototype,"icon",void 0);ze([u()],be.prototype,"size",void 0);ze([u()],be.prototype,"label",void 0);ze([u({type:Boolean})],be.prototype,"active",void 0);be=ze([S("wui-tab-item")],be);const Pn=B`
  :host {
    display: inline-flex;
    align-items: center;
    background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
    border-radius: ${({borderRadius:e})=>e[32]};
    padding: ${({spacing:e})=>e["01"]};
    box-sizing: border-box;
  }

  :host([data-size='sm']) {
    height: 26px;
  }

  :host([data-size='md']) {
    height: 36px;
  }
`;var De=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let ye=class extends k{constructor(){super(...arguments),this.tabs=[],this.onTabChange=()=>null,this.size="md",this.activeTab=0}render(){return this.dataset.size=this.size,this.tabs.map((t,n)=>{var r;const o=n===this.activeTab;return d`
        <wui-tab-item
          @click=${()=>this.onTabClick(n)}
          icon=${t.icon}
          size=${this.size}
          label=${t.label}
          ?active=${o}
          data-active=${o}
          data-testid="tab-${(r=t.label)==null?void 0:r.toLowerCase()}"
        ></wui-tab-item>
      `})}onTabClick(t){this.activeTab=t,this.onTabChange(t)}};ye.styles=[j,ae,Pn];De([u({type:Array})],ye.prototype,"tabs",void 0);De([u()],ye.prototype,"onTabChange",void 0);De([u()],ye.prototype,"size",void 0);De([C()],ye.prototype,"activeTab",void 0);ye=De([S("wui-tabs")],ye);var Tt=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let Ge=class extends k{constructor(){super(...arguments),this.platformTabs=[],this.unsubscribe=[],this.platforms=[],this.onSelectPlatfrom=void 0}disconnectCallback(){this.unsubscribe.forEach(t=>t())}render(){const t=this.generateTabs();return d`
      <wui-flex justifyContent="center" .padding=${["0","0","4","0"]}>
        <wui-tabs .tabs=${t} .onTabChange=${this.onTabChange.bind(this)}></wui-tabs>
      </wui-flex>
    `}generateTabs(){const t=this.platforms.map(n=>n==="browser"?{label:"Browser",icon:"extension",platform:"browser"}:n==="mobile"?{label:"Mobile",icon:"mobile",platform:"mobile"}:n==="qrcode"?{label:"Mobile",icon:"mobile",platform:"qrcode"}:n==="web"?{label:"Webapp",icon:"browser",platform:"web"}:n==="desktop"?{label:"Desktop",icon:"desktop",platform:"desktop"}:{label:"Browser",icon:"extension",platform:"unsupported"});return this.platformTabs=t.map(({platform:n})=>n),t}onTabChange(t){var o;const n=this.platformTabs[t];n&&((o=this.onSelectPlatfrom)==null||o.call(this,n))}};Tt([u({type:Array})],Ge.prototype,"platforms",void 0);Tt([u()],Ge.prototype,"onSelectPlatfrom",void 0);Ge=Tt([S("w3m-connecting-header")],Ge);const Ln=B`
  :host {
    width: var(--local-width);
  }

  button {
    width: var(--local-width);
    white-space: nowrap;
    column-gap: ${({spacing:e})=>e[2]};
    transition:
      scale ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-1"]},
      background-color ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      border-radius ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-1"]};
    will-change: scale, background-color, border-radius;
    cursor: pointer;
  }

  /* -- Sizes --------------------------------------------------- */
  button[data-size='sm'] {
    border-radius: ${({borderRadius:e})=>e[2]};
    padding: 0 ${({spacing:e})=>e[2]};
    height: 28px;
  }

  button[data-size='md'] {
    border-radius: ${({borderRadius:e})=>e[3]};
    padding: 0 ${({spacing:e})=>e[4]};
    height: 38px;
  }

  button[data-size='lg'] {
    border-radius: ${({borderRadius:e})=>e[4]};
    padding: 0 ${({spacing:e})=>e[5]};
    height: 48px;
  }

  /* -- Variants --------------------------------------------------------- */
  button[data-variant='accent-primary'] {
    background-color: ${({tokens:e})=>e.core.backgroundAccentPrimary};
    color: ${({tokens:e})=>e.theme.textInvert};
  }

  button[data-variant='accent-secondary'] {
    background-color: ${({tokens:e})=>e.core.foregroundAccent010};
    color: ${({tokens:e})=>e.core.textAccentPrimary};
  }

  button[data-variant='neutral-primary'] {
    background-color: ${({tokens:e})=>e.theme.backgroundInvert};
    color: ${({tokens:e})=>e.theme.textInvert};
  }

  button[data-variant='neutral-secondary'] {
    background-color: transparent;
    border: 1px solid ${({tokens:e})=>e.theme.borderSecondary};
    color: ${({tokens:e})=>e.theme.textPrimary};
  }

  button[data-variant='neutral-tertiary'] {
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    color: ${({tokens:e})=>e.theme.textPrimary};
  }

  button[data-variant='error-primary'] {
    background-color: ${({tokens:e})=>e.core.textError};
    color: ${({tokens:e})=>e.theme.textInvert};
  }

  button[data-variant='error-secondary'] {
    background-color: ${({tokens:e})=>e.core.backgroundError};
    color: ${({tokens:e})=>e.core.textError};
  }

  button[data-variant='shade'] {
    background: var(--wui-color-gray-glass-002);
    color: var(--wui-color-fg-200);
    border: none;
    box-shadow: inset 0 0 0 1px var(--wui-color-gray-glass-005);
  }

  /* -- Focus states --------------------------------------------------- */
  button[data-size='sm']:focus-visible:enabled {
    border-radius: 28px;
  }

  button[data-size='md']:focus-visible:enabled {
    border-radius: 38px;
  }

  button[data-size='lg']:focus-visible:enabled {
    border-radius: 48px;
  }
  button[data-variant='shade']:focus-visible:enabled {
    background: var(--wui-color-gray-glass-005);
    box-shadow:
      inset 0 0 0 1px var(--wui-color-gray-glass-010),
      0 0 0 4px var(--wui-color-gray-glass-002);
  }

  /* -- Hover & Active states ----------------------------------------------------------- */
  @media (hover: hover) {
    button[data-size='sm']:hover:enabled {
      border-radius: 28px;
    }

    button[data-size='md']:hover:enabled {
      border-radius: 38px;
    }

    button[data-size='lg']:hover:enabled {
      border-radius: 48px;
    }

    button[data-variant='shade']:hover:enabled {
      background: var(--wui-color-gray-glass-002);
    }

    button[data-variant='shade']:active:enabled {
      background: var(--wui-color-gray-glass-005);
    }
  }

  button[data-size='sm']:active:enabled {
    border-radius: 28px;
  }

  button[data-size='md']:active:enabled {
    border-radius: 38px;
  }

  button[data-size='lg']:active:enabled {
    border-radius: 48px;
  }

  /* -- Disabled states --------------------------------------------------- */
  button:disabled {
    opacity: 0.3;
  }
`;var xe=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};const Nn={lg:"lg-regular-mono",md:"md-regular-mono",sm:"sm-regular-mono"},On={lg:"md",md:"md",sm:"sm"};let re=class extends k{constructor(){super(...arguments),this.size="lg",this.disabled=!1,this.fullWidth=!1,this.loading=!1,this.variant="accent-primary"}render(){this.style.cssText=`
    --local-width: ${this.fullWidth?"100%":"auto"};
     `;const t=this.textVariant??Nn[this.size];return d`
      <button data-variant=${this.variant} data-size=${this.size} ?disabled=${this.disabled}>
        ${this.loadingTemplate()}
        <slot name="iconLeft"></slot>
        <wui-text variant=${t} color="inherit">
          <slot></slot>
        </wui-text>
        <slot name="iconRight"></slot>
      </button>
    `}loadingTemplate(){if(this.loading){const t=On[this.size],n=this.variant==="neutral-primary"||this.variant==="accent-primary"?"invert":"primary";return d`<wui-loading-spinner color=${n} size=${t}></wui-loading-spinner>`}return null}};re.styles=[j,ae,Ln];xe([u()],re.prototype,"size",void 0);xe([u({type:Boolean})],re.prototype,"disabled",void 0);xe([u({type:Boolean})],re.prototype,"fullWidth",void 0);xe([u({type:Boolean})],re.prototype,"loading",void 0);xe([u()],re.prototype,"variant",void 0);xe([u()],re.prototype,"textVariant",void 0);re=xe([S("wui-button")],re);const Mn=B`
  :host {
    display: block;
    width: 100px;
    height: 100px;
  }

  svg {
    width: 100px;
    height: 100px;
  }

  rect {
    fill: none;
    stroke: ${e=>e.colors.accent100};
    stroke-width: 3px;
    stroke-linecap: round;
    animation: dash 1s linear infinite;
  }

  @keyframes dash {
    to {
      stroke-dashoffset: 0px;
    }
  }
`;var Zt=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let Ye=class extends k{constructor(){super(...arguments),this.radius=36}render(){return this.svgLoaderTemplate()}svgLoaderTemplate(){const t=this.radius>50?50:this.radius,o=36-t,r=116+o,i=245+o,s=360+o*1.75;return d`
      <svg viewBox="0 0 110 110" width="110" height="110">
        <rect
          x="2"
          y="2"
          width="106"
          height="106"
          rx=${t}
          stroke-dasharray="${r} ${i}"
          stroke-dashoffset=${s}
        />
      </svg>
    `}};Ye.styles=[j,Mn];Zt([u({type:Number})],Ye.prototype,"radius",void 0);Ye=Zt([S("wui-loading-thumbnail")],Ye);const zn=B`
  wui-flex {
    width: 100%;
    height: 52px;
    box-sizing: border-box;
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    border-radius: ${({borderRadius:e})=>e[5]};
    padding-left: ${({spacing:e})=>e[3]};
    padding-right: ${({spacing:e})=>e[3]};
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({spacing:e})=>e[6]};
  }

  wui-text {
    color: ${({tokens:e})=>e.theme.textSecondary};
  }

  wui-icon {
    width: 12px;
    height: 12px;
  }
`;var st=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let Re=class extends k{constructor(){super(...arguments),this.disabled=!1,this.label="",this.buttonLabel=""}render(){return d`
      <wui-flex justifyContent="space-between" alignItems="center">
        <wui-text variant="lg-regular" color="inherit">${this.label}</wui-text>
        <wui-button variant="accent-secondary" size="sm">
          ${this.buttonLabel}
          <wui-icon name="chevronRight" color="inherit" size="inherit" slot="iconRight"></wui-icon>
        </wui-button>
      </wui-flex>
    `}};Re.styles=[j,ae,zn];st([u({type:Boolean})],Re.prototype,"disabled",void 0);st([u()],Re.prototype,"label",void 0);st([u()],Re.prototype,"buttonLabel",void 0);Re=st([S("wui-cta-button")],Re);const Dn=B`
  :host {
    display: block;
    padding: 0 ${({spacing:e})=>e[5]} ${({spacing:e})=>e[5]};
  }
`;var en=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let Je=class extends k{constructor(){super(...arguments),this.wallet=void 0}render(){if(!this.wallet)return this.style.display="none",null;const{name:t,app_store:n,play_store:o,chrome_store:r,homepage:i}=this.wallet,s=R.isMobile(),a=R.isIos(),l=R.isAndroid(),c=[n,o,i,r].filter(Boolean).length>1,g=oe.getTruncateString({string:t,charsStart:12,charsEnd:0,truncate:"end"});return c&&!s?d`
        <wui-cta-button
          label=${`Don't have ${g}?`}
          buttonLabel="Get"
          @click=${()=>E.push("Downloads",{wallet:this.wallet})}
        ></wui-cta-button>
      `:!c&&i?d`
        <wui-cta-button
          label=${`Don't have ${g}?`}
          buttonLabel="Get"
          @click=${this.onHomePage.bind(this)}
        ></wui-cta-button>
      `:n&&a?d`
        <wui-cta-button
          label=${`Don't have ${g}?`}
          buttonLabel="Get"
          @click=${this.onAppStore.bind(this)}
        ></wui-cta-button>
      `:o&&l?d`
        <wui-cta-button
          label=${`Don't have ${g}?`}
          buttonLabel="Get"
          @click=${this.onPlayStore.bind(this)}
        ></wui-cta-button>
      `:(this.style.display="none",null)}onAppStore(){var t;(t=this.wallet)!=null&&t.app_store&&R.openHref(this.wallet.app_store,"_blank")}onPlayStore(){var t;(t=this.wallet)!=null&&t.play_store&&R.openHref(this.wallet.play_store,"_blank")}onHomePage(){var t;(t=this.wallet)!=null&&t.homepage&&R.openHref(this.wallet.homepage,"_blank")}};Je.styles=[Dn];en([u({type:Object})],Je.prototype,"wallet",void 0);Je=en([S("w3m-mobile-download-links")],Je);const jn=B`
  @keyframes shake {
    0% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(3px);
    }
    50% {
      transform: translateX(-3px);
    }
    75% {
      transform: translateX(3px);
    }
    100% {
      transform: translateX(0);
    }
  }

  wui-flex:first-child:not(:only-child) {
    position: relative;
  }

  wui-wallet-image {
    width: 56px;
    height: 56px;
  }

  wui-loading-thumbnail {
    position: absolute;
  }

  wui-icon-box {
    position: absolute;
    right: calc(${({spacing:e})=>e[1]} * -1);
    bottom: calc(${({spacing:e})=>e[1]} * -1);
    opacity: 0;
    transform: scale(0.5);
    transition-property: opacity, transform;
    transition-duration: ${({durations:e})=>e.lg};
    transition-timing-function: ${({easings:e})=>e["ease-out-power-2"]};
    will-change: opacity, transform;
  }

  wui-text[align='center'] {
    width: 100%;
    padding: 0px ${({spacing:e})=>e[4]};
  }

  [data-error='true'] wui-icon-box {
    opacity: 1;
    transform: scale(1);
  }

  [data-error='true'] > wui-flex:first-child {
    animation: shake 250ms ${({easings:e})=>e["ease-out-power-2"]} both;
  }

  [data-retry='false'] wui-link {
    display: none;
  }

  [data-retry='true'] wui-link {
    display: block;
    opacity: 1;
  }

  w3m-mobile-download-links {
    padding: 0px;
    width: 100%;
  }
`;var Y=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};class L extends k{constructor(){var t,n,o,r,i;super(),this.wallet=(t=E.state.data)==null?void 0:t.wallet,this.connector=(n=E.state.data)==null?void 0:n.connector,this.timeout=void 0,this.secondaryBtnIcon="refresh",this.onConnect=void 0,this.onRender=void 0,this.onAutoConnect=void 0,this.isWalletConnect=!0,this.unsubscribe=[],this.imageSrc=he.getConnectorImage(this.connector)??he.getWalletImage(this.wallet),this.name=((o=this.wallet)==null?void 0:o.name)??((r=this.connector)==null?void 0:r.name)??"Wallet",this.isRetrying=!1,this.uri=_.state.wcUri,this.error=_.state.wcError,this.ready=!1,this.showRetry=!1,this.label=void 0,this.secondaryBtnLabel="Try again",this.secondaryLabel="Accept connection request in the wallet",this.isLoading=!1,this.isMobile=!1,this.onRetry=void 0,this.unsubscribe.push(_.subscribeKey("wcUri",s=>{var a;this.uri=s,this.isRetrying&&this.onRetry&&(this.isRetrying=!1,(a=this.onConnect)==null||a.call(this))}),_.subscribeKey("wcError",s=>this.error=s)),(R.isTelegram()||R.isSafari())&&R.isIos()&&_.state.wcUri&&((i=this.onConnect)==null||i.call(this))}firstUpdated(){var t;(t=this.onAutoConnect)==null||t.call(this),this.showRetry=!this.onAutoConnect}disconnectedCallback(){this.unsubscribe.forEach(t=>t()),_.setWcError(!1),clearTimeout(this.timeout)}render(){var o;(o=this.onRender)==null||o.call(this),this.onShowRetry();const t=this.error?"Connection can be declined if a previous request is still active":this.secondaryLabel;let n="";return this.label?n=this.label:(n=`Continue in ${this.name}`,this.error&&(n="Connection declined")),d`
      <wui-flex
        data-error=${A(this.error)}
        data-retry=${this.showRetry}
        flexDirection="column"
        alignItems="center"
        .padding=${["10","5","5","5"]}
        gap="6"
      >
        <wui-flex gap="2" justifyContent="center" alignItems="center">
          <wui-wallet-image size="lg" imageSrc=${A(this.imageSrc)}></wui-wallet-image>

          ${this.error?null:this.loaderTemplate()}

          <wui-icon-box
            color="error"
            icon="close"
            size="sm"
            border
            borderColor="wui-color-bg-125"
          ></wui-icon-box>
        </wui-flex>

        <wui-flex flexDirection="column" alignItems="center" gap="6"> <wui-flex
          flexDirection="column"
          alignItems="center"
          gap="2"
          .padding=${["2","0","0","0"]}
        >
          <wui-text align="center" variant="lg-medium" color=${this.error?"error":"primary"}>
            ${n}
          </wui-text>
          <wui-text align="center" variant="lg-regular" color="secondary">${t}</wui-text>
        </wui-flex>

        ${this.secondaryBtnLabel?d`
                <wui-button
                  variant="neutral-secondary"
                  size="md"
                  ?disabled=${this.isRetrying||this.isLoading}
                  @click=${this.onTryAgain.bind(this)}
                  data-testid="w3m-connecting-widget-secondary-button"
                >
                  <wui-icon
                    color="inherit"
                    slot="iconLeft"
                    name=${this.secondaryBtnIcon}
                  ></wui-icon>
                  ${this.secondaryBtnLabel}
                </wui-button>
              `:null}
      </wui-flex>

      ${this.isWalletConnect?d`
              <wui-flex .padding=${["0","5","5","5"]} justifyContent="center">
                <wui-link
                  @click=${this.onCopyUri}
                  variant="secondary"
                  icon="copy"
                  data-testid="wui-link-copy"
                >
                  Copy link
                </wui-link>
              </wui-flex>
            `:null}

      <w3m-mobile-download-links .wallet=${this.wallet}></w3m-mobile-download-links></wui-flex>
      </wui-flex>
    `}onShowRetry(){var t;if(this.error&&!this.showRetry){this.showRetry=!0;const n=(t=this.shadowRoot)==null?void 0:t.querySelector("wui-button");n==null||n.animate([{opacity:0},{opacity:1}],{fill:"forwards",easing:"ease"})}}onTryAgain(){var t,n;_.setWcError(!1),this.onRetry?(this.isRetrying=!0,(t=this.onRetry)==null||t.call(this)):(n=this.onConnect)==null||n.call(this)}loaderTemplate(){const t=$t.state.themeVariables["--w3m-border-radius-master"],n=t?parseInt(t.replace("px",""),10):4;return d`<wui-loading-thumbnail radius=${n*9}></wui-loading-thumbnail>`}onCopyUri(){try{this.uri&&(R.copyToClopboard(this.uri),Oe.showSuccess("Link copied"))}catch{Oe.showError("Failed to copy")}}}L.styles=jn;Y([C()],L.prototype,"isRetrying",void 0);Y([C()],L.prototype,"uri",void 0);Y([C()],L.prototype,"error",void 0);Y([C()],L.prototype,"ready",void 0);Y([C()],L.prototype,"showRetry",void 0);Y([C()],L.prototype,"label",void 0);Y([C()],L.prototype,"secondaryBtnLabel",void 0);Y([C()],L.prototype,"secondaryLabel",void 0);Y([C()],L.prototype,"isLoading",void 0);Y([u({type:Boolean})],L.prototype,"isMobile",void 0);Y([u()],L.prototype,"onRetry",void 0);var Un=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let zt=class extends L{constructor(){var t;if(super(),!this.wallet)throw new Error("w3m-connecting-wc-browser: No wallet provided");this.onConnect=this.onConnectProxy.bind(this),this.onAutoConnect=this.onConnectProxy.bind(this),O.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"browser",displayIndex:(t=this.wallet)==null?void 0:t.display_index,walletRank:this.wallet.order,view:E.state.view}})}async onConnectProxy(){var t,n;try{this.error=!1;const{connectors:o}=D.state,r=o.find(i=>{var s,a,l;return i.type==="ANNOUNCED"&&((s=i.info)==null?void 0:s.rdns)===((a=this.wallet)==null?void 0:a.rdns)||i.type==="INJECTED"||i.name===((l=this.wallet)==null?void 0:l.name)});if(r)await _.connectExternal(r,r.chain);else throw new Error("w3m-connecting-wc-browser: No connector found");Gt.close(),O.sendEvent({type:"track",event:"CONNECT_SUCCESS",properties:{method:"browser",name:((t=this.wallet)==null?void 0:t.name)||"Unknown",view:E.state.view,walletRank:(n=this.wallet)==null?void 0:n.order}})}catch(o){o instanceof Yt&&o.originalName===Jt.PROVIDER_RPC_ERROR_NAME.USER_REJECTED_REQUEST?O.sendEvent({type:"track",event:"USER_REJECTED",properties:{message:o.message}}):O.sendEvent({type:"track",event:"CONNECT_ERROR",properties:{message:(o==null?void 0:o.message)??"Unknown"}}),this.error=!0}}};zt=Un([S("w3m-connecting-wc-browser")],zt);var Fn=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let Dt=class extends L{constructor(){var t;if(super(),!this.wallet)throw new Error("w3m-connecting-wc-desktop: No wallet provided");this.onConnect=this.onConnectProxy.bind(this),this.onRender=this.onRenderProxy.bind(this),O.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"desktop",displayIndex:(t=this.wallet)==null?void 0:t.display_index,walletRank:this.wallet.order,view:E.state.view}})}onRenderProxy(){var t;!this.ready&&this.uri&&(this.ready=!0,(t=this.onConnect)==null||t.call(this))}onConnectProxy(){var t;if((t=this.wallet)!=null&&t.desktop_link&&this.uri)try{this.error=!1;const{desktop_link:n,name:o}=this.wallet,{redirect:r,href:i}=R.formatNativeUrl(n,this.uri);_.setWcLinking({name:o,href:i}),_.setRecentWallet(this.wallet),R.openHref(r,"_blank")}catch{this.error=!0}}};Dt=Fn([S("w3m-connecting-wc-desktop")],Dt);var We=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let $e=class extends L{constructor(){var t;if(super(),this.btnLabelTimeout=void 0,this.redirectDeeplink=void 0,this.redirectUniversalLink=void 0,this.target=void 0,this.preferUniversalLinks=N.state.experimental_preferUniversalLinks,this.isLoading=!0,this.onConnect=()=>{var n;if((n=this.wallet)!=null&&n.mobile_link&&this.uri)try{this.error=!1;const{mobile_link:o,link_mode:r,name:i}=this.wallet,{redirect:s,redirectUniversalLink:a,href:l}=R.formatNativeUrl(o,this.uri,r);this.redirectDeeplink=s,this.redirectUniversalLink=a,this.target=R.isIframe()?"_top":"_self",_.setWcLinking({name:i,href:l}),_.setRecentWallet(this.wallet),this.preferUniversalLinks&&this.redirectUniversalLink?R.openHref(this.redirectUniversalLink,this.target):R.openHref(this.redirectDeeplink,this.target)}catch(o){O.sendEvent({type:"track",event:"CONNECT_PROXY_ERROR",properties:{message:o instanceof Error?o.message:"Error parsing the deeplink",uri:this.uri,mobile_link:this.wallet.mobile_link,name:this.wallet.name}}),this.error=!0}},!this.wallet)throw new Error("w3m-connecting-wc-mobile: No wallet provided");this.secondaryBtnLabel="Open",this.secondaryLabel=Qt.CONNECT_LABELS.MOBILE,this.secondaryBtnIcon="externalLink",this.onHandleURI(),this.unsubscribe.push(_.subscribeKey("wcUri",()=>{this.onHandleURI()})),O.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"mobile",displayIndex:(t=this.wallet)==null?void 0:t.display_index,walletRank:this.wallet.order,view:E.state.view}})}disconnectedCallback(){super.disconnectedCallback(),clearTimeout(this.btnLabelTimeout)}onHandleURI(){var t;this.isLoading=!this.uri,!this.ready&&this.uri&&(this.ready=!0,(t=this.onConnect)==null||t.call(this))}onTryAgain(){var t;_.setWcError(!1),(t=this.onConnect)==null||t.call(this)}};We([C()],$e.prototype,"redirectDeeplink",void 0);We([C()],$e.prototype,"redirectUniversalLink",void 0);We([C()],$e.prototype,"target",void 0);We([C()],$e.prototype,"preferUniversalLinks",void 0);We([C()],$e.prototype,"isLoading",void 0);$e=We([S("w3m-connecting-wc-mobile")],$e);var je={},Vn=function(){return typeof Promise=="function"&&Promise.prototype&&Promise.prototype.then},tn={},U={};let St;const Hn=[0,26,44,70,100,134,172,196,242,292,346,404,466,532,581,655,733,815,901,991,1085,1156,1258,1364,1474,1588,1706,1828,1921,2051,2185,2323,2465,2611,2761,2876,3034,3196,3362,3532,3706];U.getSymbolSize=function(t){if(!t)throw new Error('"version" cannot be null or undefined');if(t<1||t>40)throw new Error('"version" should be in range from 1 to 40');return t*4+17};U.getSymbolTotalCodewords=function(t){return Hn[t]};U.getBCHDigit=function(e){let t=0;for(;e!==0;)t++,e>>>=1;return t};U.setToSJISFunction=function(t){if(typeof t!="function")throw new Error('"toSJISFunc" is not a valid function.');St=t};U.isKanjiModeEnabled=function(){return typeof St<"u"};U.toSJIS=function(t){return St(t)};var at={};(function(e){e.L={bit:1},e.M={bit:0},e.Q={bit:3},e.H={bit:2};function t(n){if(typeof n!="string")throw new Error("Param is not a string");switch(n.toLowerCase()){case"l":case"low":return e.L;case"m":case"medium":return e.M;case"q":case"quartile":return e.Q;case"h":case"high":return e.H;default:throw new Error("Unknown EC Level: "+n)}}e.isValid=function(o){return o&&typeof o.bit<"u"&&o.bit>=0&&o.bit<4},e.from=function(o,r){if(e.isValid(o))return o;try{return t(o)}catch{return r}}})(at);function nn(){this.buffer=[],this.length=0}nn.prototype={get:function(e){const t=Math.floor(e/8);return(this.buffer[t]>>>7-e%8&1)===1},put:function(e,t){for(let n=0;n<t;n++)this.putBit((e>>>t-n-1&1)===1)},getLengthInBits:function(){return this.length},putBit:function(e){const t=Math.floor(this.length/8);this.buffer.length<=t&&this.buffer.push(0),e&&(this.buffer[t]|=128>>>this.length%8),this.length++}};var Kn=nn;function Ue(e){if(!e||e<1)throw new Error("BitMatrix size must be defined and greater than 0");this.size=e,this.data=new Uint8Array(e*e),this.reservedBit=new Uint8Array(e*e)}Ue.prototype.set=function(e,t,n,o){const r=e*this.size+t;this.data[r]=n,o&&(this.reservedBit[r]=!0)};Ue.prototype.get=function(e,t){return this.data[e*this.size+t]};Ue.prototype.xor=function(e,t,n){this.data[e*this.size+t]^=n};Ue.prototype.isReserved=function(e,t){return this.reservedBit[e*this.size+t]};var qn=Ue,on={};(function(e){const t=U.getSymbolSize;e.getRowColCoords=function(o){if(o===1)return[];const r=Math.floor(o/7)+2,i=t(o),s=i===145?26:Math.ceil((i-13)/(2*r-2))*2,a=[i-7];for(let l=1;l<r-1;l++)a[l]=a[l-1]-s;return a.push(6),a.reverse()},e.getPositions=function(o){const r=[],i=e.getRowColCoords(o),s=i.length;for(let a=0;a<s;a++)for(let l=0;l<s;l++)a===0&&l===0||a===0&&l===s-1||a===s-1&&l===0||r.push([i[a],i[l]]);return r}})(on);var rn={};const Gn=U.getSymbolSize,jt=7;rn.getPositions=function(t){const n=Gn(t);return[[0,0],[n-jt,0],[0,n-jt]]};var sn={};(function(e){e.Patterns={PATTERN000:0,PATTERN001:1,PATTERN010:2,PATTERN011:3,PATTERN100:4,PATTERN101:5,PATTERN110:6,PATTERN111:7};const t={N1:3,N2:3,N3:40,N4:10};e.isValid=function(r){return r!=null&&r!==""&&!isNaN(r)&&r>=0&&r<=7},e.from=function(r){return e.isValid(r)?parseInt(r,10):void 0},e.getPenaltyN1=function(r){const i=r.size;let s=0,a=0,l=0,c=null,g=null;for(let I=0;I<i;I++){a=l=0,c=g=null;for(let v=0;v<i;v++){let y=r.get(I,v);y===c?a++:(a>=5&&(s+=t.N1+(a-5)),c=y,a=1),y=r.get(v,I),y===g?l++:(l>=5&&(s+=t.N1+(l-5)),g=y,l=1)}a>=5&&(s+=t.N1+(a-5)),l>=5&&(s+=t.N1+(l-5))}return s},e.getPenaltyN2=function(r){const i=r.size;let s=0;for(let a=0;a<i-1;a++)for(let l=0;l<i-1;l++){const c=r.get(a,l)+r.get(a,l+1)+r.get(a+1,l)+r.get(a+1,l+1);(c===4||c===0)&&s++}return s*t.N2},e.getPenaltyN3=function(r){const i=r.size;let s=0,a=0,l=0;for(let c=0;c<i;c++){a=l=0;for(let g=0;g<i;g++)a=a<<1&2047|r.get(c,g),g>=10&&(a===1488||a===93)&&s++,l=l<<1&2047|r.get(g,c),g>=10&&(l===1488||l===93)&&s++}return s*t.N3},e.getPenaltyN4=function(r){let i=0;const s=r.data.length;for(let l=0;l<s;l++)i+=r.data[l];return Math.abs(Math.ceil(i*100/s/5)-10)*t.N4};function n(o,r,i){switch(o){case e.Patterns.PATTERN000:return(r+i)%2===0;case e.Patterns.PATTERN001:return r%2===0;case e.Patterns.PATTERN010:return i%3===0;case e.Patterns.PATTERN011:return(r+i)%3===0;case e.Patterns.PATTERN100:return(Math.floor(r/2)+Math.floor(i/3))%2===0;case e.Patterns.PATTERN101:return r*i%2+r*i%3===0;case e.Patterns.PATTERN110:return(r*i%2+r*i%3)%2===0;case e.Patterns.PATTERN111:return(r*i%3+(r+i)%2)%2===0;default:throw new Error("bad maskPattern:"+o)}}e.applyMask=function(r,i){const s=i.size;for(let a=0;a<s;a++)for(let l=0;l<s;l++)i.isReserved(l,a)||i.xor(l,a,n(r,l,a))},e.getBestMask=function(r,i){const s=Object.keys(e.Patterns).length;let a=0,l=1/0;for(let c=0;c<s;c++){i(c),e.applyMask(c,r);const g=e.getPenaltyN1(r)+e.getPenaltyN2(r)+e.getPenaltyN3(r)+e.getPenaltyN4(r);e.applyMask(c,r),g<l&&(l=g,a=c)}return a}})(sn);var lt={};const ue=at,He=[1,1,1,1,1,1,1,1,1,1,2,2,1,2,2,4,1,2,4,4,2,4,4,4,2,4,6,5,2,4,6,6,2,5,8,8,4,5,8,8,4,5,8,11,4,8,10,11,4,9,12,16,4,9,16,16,6,10,12,18,6,10,17,16,6,11,16,19,6,13,18,21,7,14,21,25,8,16,20,25,8,17,23,25,9,17,23,34,9,18,25,30,10,20,27,32,12,21,29,35,12,23,34,37,12,25,34,40,13,26,35,42,14,28,38,45,15,29,40,48,16,31,43,51,17,33,45,54,18,35,48,57,19,37,51,60,19,38,53,63,20,40,56,66,21,43,59,70,22,45,62,74,24,47,65,77,25,49,68,81],Ke=[7,10,13,17,10,16,22,28,15,26,36,44,20,36,52,64,26,48,72,88,36,64,96,112,40,72,108,130,48,88,132,156,60,110,160,192,72,130,192,224,80,150,224,264,96,176,260,308,104,198,288,352,120,216,320,384,132,240,360,432,144,280,408,480,168,308,448,532,180,338,504,588,196,364,546,650,224,416,600,700,224,442,644,750,252,476,690,816,270,504,750,900,300,560,810,960,312,588,870,1050,336,644,952,1110,360,700,1020,1200,390,728,1050,1260,420,784,1140,1350,450,812,1200,1440,480,868,1290,1530,510,924,1350,1620,540,980,1440,1710,570,1036,1530,1800,570,1064,1590,1890,600,1120,1680,1980,630,1204,1770,2100,660,1260,1860,2220,720,1316,1950,2310,750,1372,2040,2430];lt.getBlocksCount=function(t,n){switch(n){case ue.L:return He[(t-1)*4+0];case ue.M:return He[(t-1)*4+1];case ue.Q:return He[(t-1)*4+2];case ue.H:return He[(t-1)*4+3];default:return}};lt.getTotalCodewordsCount=function(t,n){switch(n){case ue.L:return Ke[(t-1)*4+0];case ue.M:return Ke[(t-1)*4+1];case ue.Q:return Ke[(t-1)*4+2];case ue.H:return Ke[(t-1)*4+3];default:return}};var an={},ct={};const Le=new Uint8Array(512),Qe=new Uint8Array(256);(function(){let t=1;for(let n=0;n<255;n++)Le[n]=t,Qe[t]=n,t<<=1,t&256&&(t^=285);for(let n=255;n<512;n++)Le[n]=Le[n-255]})();ct.log=function(t){if(t<1)throw new Error("log("+t+")");return Qe[t]};ct.exp=function(t){return Le[t]};ct.mul=function(t,n){return t===0||n===0?0:Le[Qe[t]+Qe[n]]};(function(e){const t=ct;e.mul=function(o,r){const i=new Uint8Array(o.length+r.length-1);for(let s=0;s<o.length;s++)for(let a=0;a<r.length;a++)i[s+a]^=t.mul(o[s],r[a]);return i},e.mod=function(o,r){let i=new Uint8Array(o);for(;i.length-r.length>=0;){const s=i[0];for(let l=0;l<r.length;l++)i[l]^=t.mul(r[l],s);let a=0;for(;a<i.length&&i[a]===0;)a++;i=i.slice(a)}return i},e.generateECPolynomial=function(o){let r=new Uint8Array([1]);for(let i=0;i<o;i++)r=e.mul(r,new Uint8Array([1,t.exp(i)]));return r}})(an);const ln=an;function It(e){this.genPoly=void 0,this.degree=e,this.degree&&this.initialize(this.degree)}It.prototype.initialize=function(t){this.degree=t,this.genPoly=ln.generateECPolynomial(this.degree)};It.prototype.encode=function(t){if(!this.genPoly)throw new Error("Encoder not initialized");const n=new Uint8Array(t.length+this.degree);n.set(t);const o=ln.mod(n,this.genPoly),r=this.degree-o.length;if(r>0){const i=new Uint8Array(this.degree);return i.set(o,r),i}return o};var Yn=It,cn={},fe={},kt={};kt.isValid=function(t){return!isNaN(t)&&t>=1&&t<=40};var Z={};const dn="[0-9]+",Jn="[A-Z $%*+\\-./:]+";let Me="(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";Me=Me.replace(/u/g,"\\u");const Qn="(?:(?![A-Z0-9 $%*+\\-./:]|"+Me+`)(?:.|[\r
]))+`;Z.KANJI=new RegExp(Me,"g");Z.BYTE_KANJI=new RegExp("[^A-Z0-9 $%*+\\-./:]+","g");Z.BYTE=new RegExp(Qn,"g");Z.NUMERIC=new RegExp(dn,"g");Z.ALPHANUMERIC=new RegExp(Jn,"g");const Xn=new RegExp("^"+Me+"$"),Zn=new RegExp("^"+dn+"$"),ei=new RegExp("^[A-Z0-9 $%*+\\-./:]+$");Z.testKanji=function(t){return Xn.test(t)};Z.testNumeric=function(t){return Zn.test(t)};Z.testAlphanumeric=function(t){return ei.test(t)};(function(e){const t=kt,n=Z;e.NUMERIC={id:"Numeric",bit:1,ccBits:[10,12,14]},e.ALPHANUMERIC={id:"Alphanumeric",bit:2,ccBits:[9,11,13]},e.BYTE={id:"Byte",bit:4,ccBits:[8,16,16]},e.KANJI={id:"Kanji",bit:8,ccBits:[8,10,12]},e.MIXED={bit:-1},e.getCharCountIndicator=function(i,s){if(!i.ccBits)throw new Error("Invalid mode: "+i);if(!t.isValid(s))throw new Error("Invalid version: "+s);return s>=1&&s<10?i.ccBits[0]:s<27?i.ccBits[1]:i.ccBits[2]},e.getBestModeForData=function(i){return n.testNumeric(i)?e.NUMERIC:n.testAlphanumeric(i)?e.ALPHANUMERIC:n.testKanji(i)?e.KANJI:e.BYTE},e.toString=function(i){if(i&&i.id)return i.id;throw new Error("Invalid mode")},e.isValid=function(i){return i&&i.bit&&i.ccBits};function o(r){if(typeof r!="string")throw new Error("Param is not a string");switch(r.toLowerCase()){case"numeric":return e.NUMERIC;case"alphanumeric":return e.ALPHANUMERIC;case"kanji":return e.KANJI;case"byte":return e.BYTE;default:throw new Error("Unknown mode: "+r)}}e.from=function(i,s){if(e.isValid(i))return i;try{return o(i)}catch{return s}}})(fe);(function(e){const t=U,n=lt,o=at,r=fe,i=kt,s=7973,a=t.getBCHDigit(s);function l(v,y,$){for(let h=1;h<=40;h++)if(y<=e.getCapacity(h,$,v))return h}function c(v,y){return r.getCharCountIndicator(v,y)+4}function g(v,y){let $=0;return v.forEach(function(h){const b=c(h.mode,y);$+=b+h.getBitsLength()}),$}function I(v,y){for(let $=1;$<=40;$++)if(g(v,$)<=e.getCapacity($,y,r.MIXED))return $}e.from=function(y,$){return i.isValid(y)?parseInt(y,10):$},e.getCapacity=function(y,$,h){if(!i.isValid(y))throw new Error("Invalid QR Code version");typeof h>"u"&&(h=r.BYTE);const b=t.getSymbolTotalCodewords(y),f=n.getTotalCodewordsCount(y,$),m=(b-f)*8;if(h===r.MIXED)return m;const w=m-c(h,y);switch(h){case r.NUMERIC:return Math.floor(w/10*3);case r.ALPHANUMERIC:return Math.floor(w/11*2);case r.KANJI:return Math.floor(w/13);case r.BYTE:default:return Math.floor(w/8)}},e.getBestVersionForData=function(y,$){let h;const b=o.from($,o.M);if(Array.isArray(y)){if(y.length>1)return I(y,b);if(y.length===0)return 1;h=y[0]}else h=y;return l(h.mode,h.getLength(),b)},e.getEncodedBits=function(y){if(!i.isValid(y)||y<7)throw new Error("Invalid QR Code version");let $=y<<12;for(;t.getBCHDigit($)-a>=0;)$^=s<<t.getBCHDigit($)-a;return y<<12|$}})(cn);var un={};const Ct=U,hn=1335,ti=21522,Ut=Ct.getBCHDigit(hn);un.getEncodedBits=function(t,n){const o=t.bit<<3|n;let r=o<<10;for(;Ct.getBCHDigit(r)-Ut>=0;)r^=hn<<Ct.getBCHDigit(r)-Ut;return(o<<10|r)^ti};var fn={};const ni=fe;function _e(e){this.mode=ni.NUMERIC,this.data=e.toString()}_e.getBitsLength=function(t){return 10*Math.floor(t/3)+(t%3?t%3*3+1:0)};_e.prototype.getLength=function(){return this.data.length};_e.prototype.getBitsLength=function(){return _e.getBitsLength(this.data.length)};_e.prototype.write=function(t){let n,o,r;for(n=0;n+3<=this.data.length;n+=3)o=this.data.substr(n,3),r=parseInt(o,10),t.put(r,10);const i=this.data.length-n;i>0&&(o=this.data.substr(n),r=parseInt(o,10),t.put(r,i*3+1))};var ii=_e;const oi=fe,ft=["0","1","2","3","4","5","6","7","8","9","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"," ","$","%","*","+","-",".","/",":"];function Te(e){this.mode=oi.ALPHANUMERIC,this.data=e}Te.getBitsLength=function(t){return 11*Math.floor(t/2)+6*(t%2)};Te.prototype.getLength=function(){return this.data.length};Te.prototype.getBitsLength=function(){return Te.getBitsLength(this.data.length)};Te.prototype.write=function(t){let n;for(n=0;n+2<=this.data.length;n+=2){let o=ft.indexOf(this.data[n])*45;o+=ft.indexOf(this.data[n+1]),t.put(o,11)}this.data.length%2&&t.put(ft.indexOf(this.data[n]),6)};var ri=Te,si=function(t){for(var n=[],o=t.length,r=0;r<o;r++){var i=t.charCodeAt(r);if(i>=55296&&i<=56319&&o>r+1){var s=t.charCodeAt(r+1);s>=56320&&s<=57343&&(i=(i-55296)*1024+s-56320+65536,r+=1)}if(i<128){n.push(i);continue}if(i<2048){n.push(i>>6|192),n.push(i&63|128);continue}if(i<55296||i>=57344&&i<65536){n.push(i>>12|224),n.push(i>>6&63|128),n.push(i&63|128);continue}if(i>=65536&&i<=1114111){n.push(i>>18|240),n.push(i>>12&63|128),n.push(i>>6&63|128),n.push(i&63|128);continue}n.push(239,191,189)}return new Uint8Array(n).buffer};const ai=si,li=fe;function Se(e){this.mode=li.BYTE,typeof e=="string"&&(e=ai(e)),this.data=new Uint8Array(e)}Se.getBitsLength=function(t){return t*8};Se.prototype.getLength=function(){return this.data.length};Se.prototype.getBitsLength=function(){return Se.getBitsLength(this.data.length)};Se.prototype.write=function(e){for(let t=0,n=this.data.length;t<n;t++)e.put(this.data[t],8)};var ci=Se;const di=fe,ui=U;function Ie(e){this.mode=di.KANJI,this.data=e}Ie.getBitsLength=function(t){return t*13};Ie.prototype.getLength=function(){return this.data.length};Ie.prototype.getBitsLength=function(){return Ie.getBitsLength(this.data.length)};Ie.prototype.write=function(e){let t;for(t=0;t<this.data.length;t++){let n=ui.toSJIS(this.data[t]);if(n>=33088&&n<=40956)n-=33088;else if(n>=57408&&n<=60351)n-=49472;else throw new Error("Invalid SJIS character: "+this.data[t]+`
Make sure your charset is UTF-8`);n=(n>>>8&255)*192+(n&255),e.put(n,13)}};var hi=Ie;(function(e){const t=fe,n=ii,o=ri,r=ci,i=hi,s=Z,a=U,l=In;function c(f){return unescape(encodeURIComponent(f)).length}function g(f,m,w){const p=[];let x;for(;(x=f.exec(w))!==null;)p.push({data:x[0],index:x.index,mode:m,length:x[0].length});return p}function I(f){const m=g(s.NUMERIC,t.NUMERIC,f),w=g(s.ALPHANUMERIC,t.ALPHANUMERIC,f);let p,x;return a.isKanjiModeEnabled()?(p=g(s.BYTE,t.BYTE,f),x=g(s.KANJI,t.KANJI,f)):(p=g(s.BYTE_KANJI,t.BYTE,f),x=[]),m.concat(w,p,x).sort(function(P,q){return P.index-q.index}).map(function(P){return{data:P.data,mode:P.mode,length:P.length}})}function v(f,m){switch(m){case t.NUMERIC:return n.getBitsLength(f);case t.ALPHANUMERIC:return o.getBitsLength(f);case t.KANJI:return i.getBitsLength(f);case t.BYTE:return r.getBitsLength(f)}}function y(f){return f.reduce(function(m,w){const p=m.length-1>=0?m[m.length-1]:null;return p&&p.mode===w.mode?(m[m.length-1].data+=w.data,m):(m.push(w),m)},[])}function $(f){const m=[];for(let w=0;w<f.length;w++){const p=f[w];switch(p.mode){case t.NUMERIC:m.push([p,{data:p.data,mode:t.ALPHANUMERIC,length:p.length},{data:p.data,mode:t.BYTE,length:p.length}]);break;case t.ALPHANUMERIC:m.push([p,{data:p.data,mode:t.BYTE,length:p.length}]);break;case t.KANJI:m.push([p,{data:p.data,mode:t.BYTE,length:c(p.data)}]);break;case t.BYTE:m.push([{data:p.data,mode:t.BYTE,length:c(p.data)}])}}return m}function h(f,m){const w={},p={start:{}};let x=["start"];for(let W=0;W<f.length;W++){const P=f[W],q=[];for(let ce=0;ce<P.length;ce++){const J=P[ce],Be=""+W+ce;q.push(Be),w[Be]={node:J,lastCount:0},p[Be]={};for(let ht=0;ht<x.length;ht++){const ne=x[ht];w[ne]&&w[ne].node.mode===J.mode?(p[ne][Be]=v(w[ne].lastCount+J.length,J.mode)-v(w[ne].lastCount,J.mode),w[ne].lastCount+=J.length):(w[ne]&&(w[ne].lastCount=J.length),p[ne][Be]=v(J.length,J.mode)+4+t.getCharCountIndicator(J.mode,m))}}x=q}for(let W=0;W<x.length;W++)p[x[W]].end=0;return{map:p,table:w}}function b(f,m){let w;const p=t.getBestModeForData(f);if(w=t.from(m,p),w!==t.BYTE&&w.bit<p.bit)throw new Error('"'+f+'" cannot be encoded with mode '+t.toString(w)+`.
 Suggested mode is: `+t.toString(p));switch(w===t.KANJI&&!a.isKanjiModeEnabled()&&(w=t.BYTE),w){case t.NUMERIC:return new n(f);case t.ALPHANUMERIC:return new o(f);case t.KANJI:return new i(f);case t.BYTE:return new r(f)}}e.fromArray=function(m){return m.reduce(function(w,p){return typeof p=="string"?w.push(b(p,null)):p.data&&w.push(b(p.data,p.mode)),w},[])},e.fromString=function(m,w){const p=I(m,a.isKanjiModeEnabled()),x=$(p),W=h(x,w),P=l.find_path(W.map,"start","end"),q=[];for(let ce=1;ce<P.length-1;ce++)q.push(W.table[P[ce]].node);return e.fromArray(y(q))},e.rawSplit=function(m){return e.fromArray(I(m,a.isKanjiModeEnabled()))}})(fn);const dt=U,pt=at,fi=Kn,pi=qn,gi=on,mi=rn,xt=sn,Et=lt,wi=Yn,Xe=cn,bi=un,yi=fe,gt=fn;function $i(e,t){const n=e.size,o=mi.getPositions(t);for(let r=0;r<o.length;r++){const i=o[r][0],s=o[r][1];for(let a=-1;a<=7;a++)if(!(i+a<=-1||n<=i+a))for(let l=-1;l<=7;l++)s+l<=-1||n<=s+l||(a>=0&&a<=6&&(l===0||l===6)||l>=0&&l<=6&&(a===0||a===6)||a>=2&&a<=4&&l>=2&&l<=4?e.set(i+a,s+l,!0,!0):e.set(i+a,s+l,!1,!0))}}function vi(e){const t=e.size;for(let n=8;n<t-8;n++){const o=n%2===0;e.set(n,6,o,!0),e.set(6,n,o,!0)}}function Ci(e,t){const n=gi.getPositions(t);for(let o=0;o<n.length;o++){const r=n[o][0],i=n[o][1];for(let s=-2;s<=2;s++)for(let a=-2;a<=2;a++)s===-2||s===2||a===-2||a===2||s===0&&a===0?e.set(r+s,i+a,!0,!0):e.set(r+s,i+a,!1,!0)}}function xi(e,t){const n=e.size,o=Xe.getEncodedBits(t);let r,i,s;for(let a=0;a<18;a++)r=Math.floor(a/3),i=a%3+n-8-3,s=(o>>a&1)===1,e.set(r,i,s,!0),e.set(i,r,s,!0)}function mt(e,t,n){const o=e.size,r=bi.getEncodedBits(t,n);let i,s;for(i=0;i<15;i++)s=(r>>i&1)===1,i<6?e.set(i,8,s,!0):i<8?e.set(i+1,8,s,!0):e.set(o-15+i,8,s,!0),i<8?e.set(8,o-i-1,s,!0):i<9?e.set(8,15-i-1+1,s,!0):e.set(8,15-i-1,s,!0);e.set(o-8,8,1,!0)}function Ei(e,t){const n=e.size;let o=-1,r=n-1,i=7,s=0;for(let a=n-1;a>0;a-=2)for(a===6&&a--;;){for(let l=0;l<2;l++)if(!e.isReserved(r,a-l)){let c=!1;s<t.length&&(c=(t[s]>>>i&1)===1),e.set(r,a-l,c),i--,i===-1&&(s++,i=7)}if(r+=o,r<0||n<=r){r-=o,o=-o;break}}}function Ri(e,t,n){const o=new fi;n.forEach(function(l){o.put(l.mode.bit,4),o.put(l.getLength(),yi.getCharCountIndicator(l.mode,e)),l.write(o)});const r=dt.getSymbolTotalCodewords(e),i=Et.getTotalCodewordsCount(e,t),s=(r-i)*8;for(o.getLengthInBits()+4<=s&&o.put(0,4);o.getLengthInBits()%8!==0;)o.putBit(0);const a=(s-o.getLengthInBits())/8;for(let l=0;l<a;l++)o.put(l%2?17:236,8);return _i(o,e,t)}function _i(e,t,n){const o=dt.getSymbolTotalCodewords(t),r=Et.getTotalCodewordsCount(t,n),i=o-r,s=Et.getBlocksCount(t,n),a=o%s,l=s-a,c=Math.floor(o/s),g=Math.floor(i/s),I=g+1,v=c-g,y=new wi(v);let $=0;const h=new Array(s),b=new Array(s);let f=0;const m=new Uint8Array(e.buffer);for(let P=0;P<s;P++){const q=P<l?g:I;h[P]=m.slice($,$+q),b[P]=y.encode(h[P]),$+=q,f=Math.max(f,q)}const w=new Uint8Array(o);let p=0,x,W;for(x=0;x<f;x++)for(W=0;W<s;W++)x<h[W].length&&(w[p++]=h[W][x]);for(x=0;x<v;x++)for(W=0;W<s;W++)w[p++]=b[W][x];return w}function Ti(e,t,n,o){let r;if(Array.isArray(e))r=gt.fromArray(e);else if(typeof e=="string"){let c=t;if(!c){const g=gt.rawSplit(e);c=Xe.getBestVersionForData(g,n)}r=gt.fromString(e,c||40)}else throw new Error("Invalid data");const i=Xe.getBestVersionForData(r,n);if(!i)throw new Error("The amount of data is too big to be stored in a QR Code");if(!t)t=i;else if(t<i)throw new Error(`
The chosen QR Code version cannot contain this amount of data.
Minimum version required to store current data is: `+i+`.
`);const s=Ri(t,n,r),a=dt.getSymbolSize(t),l=new pi(a);return $i(l,t),vi(l),Ci(l,t),mt(l,n,0),t>=7&&xi(l,t),Ei(l,s),isNaN(o)&&(o=xt.getBestMask(l,mt.bind(null,l,n))),xt.applyMask(o,l),mt(l,n,o),{modules:l,version:t,errorCorrectionLevel:n,maskPattern:o,segments:r}}tn.create=function(t,n){if(typeof t>"u"||t==="")throw new Error("No input text");let o=pt.M,r,i;return typeof n<"u"&&(o=pt.from(n.errorCorrectionLevel,pt.M),r=Xe.from(n.version),i=xt.from(n.maskPattern),n.toSJISFunc&&dt.setToSJISFunction(n.toSJISFunc)),Ti(t,r,o,i)};var pn={},At={};(function(e){function t(n){if(typeof n=="number"&&(n=n.toString()),typeof n!="string")throw new Error("Color should be defined as hex string");let o=n.slice().replace("#","").split("");if(o.length<3||o.length===5||o.length>8)throw new Error("Invalid hex color: "+n);(o.length===3||o.length===4)&&(o=Array.prototype.concat.apply([],o.map(function(i){return[i,i]}))),o.length===6&&o.push("F","F");const r=parseInt(o.join(""),16);return{r:r>>24&255,g:r>>16&255,b:r>>8&255,a:r&255,hex:"#"+o.slice(0,6).join("")}}e.getOptions=function(o){o||(o={}),o.color||(o.color={});const r=typeof o.margin>"u"||o.margin===null||o.margin<0?4:o.margin,i=o.width&&o.width>=21?o.width:void 0,s=o.scale||4;return{width:i,scale:i?4:s,margin:r,color:{dark:t(o.color.dark||"#000000ff"),light:t(o.color.light||"#ffffffff")},type:o.type,rendererOpts:o.rendererOpts||{}}},e.getScale=function(o,r){return r.width&&r.width>=o+r.margin*2?r.width/(o+r.margin*2):r.scale},e.getImageWidth=function(o,r){const i=e.getScale(o,r);return Math.floor((o+r.margin*2)*i)},e.qrToImageData=function(o,r,i){const s=r.modules.size,a=r.modules.data,l=e.getScale(s,i),c=Math.floor((s+i.margin*2)*l),g=i.margin*l,I=[i.color.light,i.color.dark];for(let v=0;v<c;v++)for(let y=0;y<c;y++){let $=(v*c+y)*4,h=i.color.light;if(v>=g&&y>=g&&v<c-g&&y<c-g){const b=Math.floor((v-g)/l),f=Math.floor((y-g)/l);h=I[a[b*s+f]?1:0]}o[$++]=h.r,o[$++]=h.g,o[$++]=h.b,o[$]=h.a}}})(At);(function(e){const t=At;function n(r,i,s){r.clearRect(0,0,i.width,i.height),i.style||(i.style={}),i.height=s,i.width=s,i.style.height=s+"px",i.style.width=s+"px"}function o(){try{return document.createElement("canvas")}catch{throw new Error("You need to specify a canvas element")}}e.render=function(i,s,a){let l=a,c=s;typeof l>"u"&&(!s||!s.getContext)&&(l=s,s=void 0),s||(c=o()),l=t.getOptions(l);const g=t.getImageWidth(i.modules.size,l),I=c.getContext("2d"),v=I.createImageData(g,g);return t.qrToImageData(v.data,i,l),n(I,c,g),I.putImageData(v,0,0),c},e.renderToDataURL=function(i,s,a){let l=a;typeof l>"u"&&(!s||!s.getContext)&&(l=s,s=void 0),l||(l={});const c=e.render(i,s,l),g=l.type||"image/png",I=l.rendererOpts||{};return c.toDataURL(g,I.quality)}})(pn);var gn={};const Si=At;function Ft(e,t){const n=e.a/255,o=t+'="'+e.hex+'"';return n<1?o+" "+t+'-opacity="'+n.toFixed(2).slice(1)+'"':o}function wt(e,t,n){let o=e+t;return typeof n<"u"&&(o+=" "+n),o}function Ii(e,t,n){let o="",r=0,i=!1,s=0;for(let a=0;a<e.length;a++){const l=Math.floor(a%t),c=Math.floor(a/t);!l&&!i&&(i=!0),e[a]?(s++,a>0&&l>0&&e[a-1]||(o+=i?wt("M",l+n,.5+c+n):wt("m",r,0),r=0,i=!1),l+1<t&&e[a+1]||(o+=wt("h",s),s=0)):r++}return o}gn.render=function(t,n,o){const r=Si.getOptions(n),i=t.modules.size,s=t.modules.data,a=i+r.margin*2,l=r.color.light.a?"<path "+Ft(r.color.light,"fill")+' d="M0 0h'+a+"v"+a+'H0z"/>':"",c="<path "+Ft(r.color.dark,"stroke")+' d="'+Ii(s,i,r.margin)+'"/>',g='viewBox="0 0 '+a+" "+a+'"',v='<svg xmlns="http://www.w3.org/2000/svg" '+(r.width?'width="'+r.width+'" height="'+r.width+'" ':"")+g+' shape-rendering="crispEdges">'+l+c+`</svg>
`;return typeof o=="function"&&o(null,v),v};const ki=Vn,Rt=tn,mn=pn,Ai=gn;function Wt(e,t,n,o,r){const i=[].slice.call(arguments,1),s=i.length,a=typeof i[s-1]=="function";if(!a&&!ki())throw new Error("Callback required as last argument");if(a){if(s<2)throw new Error("Too few arguments provided");s===2?(r=n,n=t,t=o=void 0):s===3&&(t.getContext&&typeof r>"u"?(r=o,o=void 0):(r=o,o=n,n=t,t=void 0))}else{if(s<1)throw new Error("Too few arguments provided");return s===1?(n=t,t=o=void 0):s===2&&!t.getContext&&(o=n,n=t,t=void 0),new Promise(function(l,c){try{const g=Rt.create(n,o);l(e(g,t,o))}catch(g){c(g)}})}try{const l=Rt.create(n,o);r(null,e(l,t,o))}catch(l){r(l)}}je.create=Rt.create;je.toCanvas=Wt.bind(null,mn.render);je.toDataURL=Wt.bind(null,mn.renderToDataURL);je.toString=Wt.bind(null,function(e,t,n){return Ai.render(e,n)});const Wi=.1,Vt=2.5,ie=7;function bt(e,t,n){return e===t?!1:(e-t<0?t-e:e-t)<=n+Wi}function Bi(e,t){const n=Array.prototype.slice.call(je.create(e,{errorCorrectionLevel:t}).modules.data,0),o=Math.sqrt(n.length);return n.reduce((r,i,s)=>(s%o===0?r.push([i]):r[r.length-1].push(i))&&r,[])}const Pi={generate({uri:e,size:t,logoSize:n,padding:o=8,dotColor:r="var(--apkt-colors-black)"}){const s=[],a=Bi(e,"Q"),l=(t-2*o)/a.length,c=[{x:0,y:0},{x:1,y:0},{x:0,y:1}];c.forEach(({x:h,y:b})=>{const f=(a.length-ie)*l*h+o,m=(a.length-ie)*l*b+o,w=.45;for(let p=0;p<c.length;p+=1){const x=l*(ie-p*2);s.push(Pe`
            <rect
              fill=${p===2?"var(--apkt-colors-black)":"var(--apkt-colors-white)"}
              width=${p===0?x-10:x}
              rx= ${p===0?(x-10)*w:x*w}
              ry= ${p===0?(x-10)*w:x*w}
              stroke=${r}
              stroke-width=${p===0?10:0}
              height=${p===0?x-10:x}
              x= ${p===0?m+l*p+10/2:m+l*p}
              y= ${p===0?f+l*p+10/2:f+l*p}
            />
          `)}});const g=Math.floor((n+25)/l),I=a.length/2-g/2,v=a.length/2+g/2-1,y=[];a.forEach((h,b)=>{h.forEach((f,m)=>{if(a[b][m]&&!(b<ie&&m<ie||b>a.length-(ie+1)&&m<ie||b<ie&&m>a.length-(ie+1))&&!(b>I&&b<v&&m>I&&m<v)){const w=b*l+l/2+o,p=m*l+l/2+o;y.push([w,p])}})});const $={};return y.forEach(([h,b])=>{var f;$[h]?(f=$[h])==null||f.push(b):$[h]=[b]}),Object.entries($).map(([h,b])=>{const f=b.filter(m=>b.every(w=>!bt(m,w,l)));return[Number(h),f]}).forEach(([h,b])=>{b.forEach(f=>{s.push(Pe`<circle cx=${h} cy=${f} fill=${r} r=${l/Vt} />`)})}),Object.entries($).filter(([h,b])=>b.length>1).map(([h,b])=>{const f=b.filter(m=>b.some(w=>bt(m,w,l)));return[Number(h),f]}).map(([h,b])=>{b.sort((m,w)=>m<w?-1:1);const f=[];for(const m of b){const w=f.find(p=>p.some(x=>bt(m,x,l)));w?w.push(m):f.push([m])}return[h,f.map(m=>[m[0],m[m.length-1]])]}).forEach(([h,b])=>{b.forEach(([f,m])=>{s.push(Pe`
              <line
                x1=${h}
                x2=${h}
                y1=${f}
                y2=${m}
                stroke=${r}
                stroke-width=${l/(Vt/2)}
                stroke-linecap="round"
              />
            `)})}),s}},Li=B`
  :host {
    position: relative;
    user-select: none;
    display: block;
    overflow: hidden;
    aspect-ratio: 1 / 1;
    width: 100%;
    height: 100%;
    background-color: ${({colors:e})=>e.white};
    border: 1px solid ${({tokens:e})=>e.theme.borderPrimary};
  }

  :host {
    border-radius: ${({borderRadius:e})=>e[4]};
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :host([data-clear='true']) > wui-icon {
    display: none;
  }

  svg:first-child,
  wui-image,
  wui-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translateY(-50%) translateX(-50%);
    background-color: ${({tokens:e})=>e.theme.backgroundPrimary};
    box-shadow: inset 0 0 0 4px ${({tokens:e})=>e.theme.backgroundPrimary};
    border-radius: ${({borderRadius:e})=>e[6]};
  }

  wui-image {
    width: 25%;
    height: 25%;
    border-radius: ${({borderRadius:e})=>e[2]};
  }

  wui-icon {
    width: 100%;
    height: 100%;
    color: #3396ff !important;
    transform: translateY(-50%) translateX(-50%) scale(0.25);
  }

  wui-icon > svg {
    width: inherit;
    height: inherit;
  }
`;var pe=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let Q=class extends k{constructor(){super(...arguments),this.uri="",this.size=0,this.theme="dark",this.imageSrc=void 0,this.alt=void 0,this.arenaClear=void 0,this.farcaster=void 0}render(){return this.dataset.theme=this.theme,this.dataset.clear=String(this.arenaClear),this.style.cssText=`--local-size: ${this.size}px`,d`<wui-flex
      alignItems="center"
      justifyContent="center"
      class="wui-qr-code"
      direction="column"
      gap="4"
      width="100%"
      style="height: 100%"
    >
      ${this.templateVisual()} ${this.templateSvg()}
    </wui-flex>`}templateSvg(){return Pe`
      <svg height=${this.size} width=${this.size}>
        ${Pi.generate({uri:this.uri,size:this.size,logoSize:this.arenaClear?0:this.size/4})}
      </svg>
    `}templateVisual(){return this.imageSrc?d`<wui-image src=${this.imageSrc} alt=${this.alt??"logo"}></wui-image>`:this.farcaster?d`<wui-icon
        class="farcaster"
        size="inherit"
        color="inherit"
        name="farcaster"
      ></wui-icon>`:d`<wui-icon size="inherit" color="inherit" name="walletConnect"></wui-icon>`}};Q.styles=[j,Li];pe([u()],Q.prototype,"uri",void 0);pe([u({type:Number})],Q.prototype,"size",void 0);pe([u()],Q.prototype,"theme",void 0);pe([u()],Q.prototype,"imageSrc",void 0);pe([u()],Q.prototype,"alt",void 0);pe([u({type:Boolean})],Q.prototype,"arenaClear",void 0);pe([u({type:Boolean})],Q.prototype,"farcaster",void 0);Q=pe([S("wui-qr-code")],Q);const Ni=B`
  :host {
    display: block;
    background: linear-gradient(
      90deg,
      ${({tokens:e})=>e.theme.foregroundSecondary} 0%,
      ${({tokens:e})=>e.theme.foregroundTertiary} 50%,
      ${({tokens:e})=>e.theme.foregroundSecondary} 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1s ease-in-out infinite;
    border-radius: ${({borderRadius:e})=>e[2]};
  }

  :host([data-rounded='true']) {
    border-radius: ${({borderRadius:e})=>e[16]};
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`;var Fe=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let ve=class extends k{constructor(){super(...arguments),this.width="",this.height="",this.variant="default",this.rounded=!1}render(){return this.style.cssText=`
      width: ${this.width};
      height: ${this.height};
    `,this.dataset.rounded=this.rounded?"true":"false",d`<slot></slot>`}};ve.styles=[Ni];Fe([u()],ve.prototype,"width",void 0);Fe([u()],ve.prototype,"height",void 0);Fe([u()],ve.prototype,"variant",void 0);Fe([u({type:Boolean})],ve.prototype,"rounded",void 0);ve=Fe([S("wui-shimmer")],ve);const Oi=B`
  wui-shimmer {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: ${({borderRadius:e})=>e[4]};
  }

  wui-qr-code {
    opacity: 0;
    animation-duration: ${({durations:e})=>e.xl};
    animation-timing-function: ${({easings:e})=>e["ease-out-power-2"]};
    animation-name: fade-in;
    animation-fill-mode: forwards;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;var wn=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let Ze=class extends L{constructor(){super(),this.basic=!1,this.forceUpdate=()=>{this.requestUpdate()},window.addEventListener("resize",this.forceUpdate)}firstUpdated(){var t,n,o;this.basic||O.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:((t=this.wallet)==null?void 0:t.name)??"WalletConnect",platform:"qrcode",displayIndex:(n=this.wallet)==null?void 0:n.display_index,walletRank:(o=this.wallet)==null?void 0:o.order,view:E.state.view}})}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this.unsubscribe)==null||t.forEach(n=>n()),window.removeEventListener("resize",this.forceUpdate)}render(){return this.onRenderProxy(),d`
      <wui-flex
        flexDirection="column"
        alignItems="center"
        .padding=${["0","5","5","5"]}
        gap="5"
      >
        <wui-shimmer width="100%"> ${this.qrCodeTemplate()} </wui-shimmer>
        <wui-text variant="lg-medium" color="primary"> Scan this QR Code with your phone </wui-text>
        ${this.copyTemplate()}
      </wui-flex>
      <w3m-mobile-download-links .wallet=${this.wallet}></w3m-mobile-download-links>
    `}onRenderProxy(){!this.ready&&this.uri&&(this.timeout=setTimeout(()=>{this.ready=!0},200))}qrCodeTemplate(){var r,i;if(!this.uri||!this.ready)return null;const t=this.getBoundingClientRect().width-40,n=this.wallet?this.wallet.name:void 0;_.setWcLinking(void 0),_.setRecentWallet(this.wallet);let o=this.uri;if((r=this.wallet)!=null&&r.mobile_link){const{redirect:s}=R.formatNativeUrl((i=this.wallet)==null?void 0:i.mobile_link,this.uri,null);o=s}return d` <wui-qr-code
      size=${t}
      theme=${$t.state.themeMode}
      uri=${o}
      imageSrc=${A(he.getWalletImage(this.wallet))}
      color=${A($t.state.themeVariables["--w3m-qr-color"])}
      alt=${A(n)}
      data-testid="wui-qr-code"
    ></wui-qr-code>`}copyTemplate(){const t=!this.uri||!this.ready;return d`<wui-button
      .disabled=${t}
      @click=${this.onCopyUri}
      variant="neutral-secondary"
      size="sm"
      data-testid="copy-wc2-uri"
    >
      Copy link
      <wui-icon size="sm" color="inherit" name="copy" slot="iconRight"></wui-icon>
    </wui-button>`}};Ze.styles=Oi;wn([u({type:Boolean})],Ze.prototype,"basic",void 0);Ze=wn([S("w3m-connecting-wc-qrcode")],Ze);var Mi=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let Ht=class extends k{constructor(){var t,n,o;if(super(),this.wallet=(t=E.state.data)==null?void 0:t.wallet,!this.wallet)throw new Error("w3m-connecting-wc-unsupported: No wallet provided");O.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"browser",displayIndex:(n=this.wallet)==null?void 0:n.display_index,walletRank:(o=this.wallet)==null?void 0:o.order,view:E.state.view}})}render(){return d`
      <wui-flex
        flexDirection="column"
        alignItems="center"
        .padding=${["10","5","5","5"]}
        gap="5"
      >
        <wui-wallet-image
          size="lg"
          imageSrc=${A(he.getWalletImage(this.wallet))}
        ></wui-wallet-image>

        <wui-text variant="md-regular" color="primary">Not Detected</wui-text>
      </wui-flex>

      <w3m-mobile-download-links .wallet=${this.wallet}></w3m-mobile-download-links>
    `}};Ht=Mi([S("w3m-connecting-wc-unsupported")],Ht);var bn=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let _t=class extends L{constructor(){var t,n;if(super(),this.isLoading=!0,!this.wallet)throw new Error("w3m-connecting-wc-web: No wallet provided");this.onConnect=this.onConnectProxy.bind(this),this.secondaryBtnLabel="Open",this.secondaryLabel=Qt.CONNECT_LABELS.MOBILE,this.secondaryBtnIcon="externalLink",this.updateLoadingState(),this.unsubscribe.push(_.subscribeKey("wcUri",()=>{this.updateLoadingState()})),O.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"web",displayIndex:(t=this.wallet)==null?void 0:t.display_index,walletRank:(n=this.wallet)==null?void 0:n.order,view:E.state.view}})}updateLoadingState(){this.isLoading=!this.uri}onConnectProxy(){var t;if((t=this.wallet)!=null&&t.webapp_link&&this.uri)try{this.error=!1;const{webapp_link:n,name:o}=this.wallet,{redirect:r,href:i}=R.formatUniversalUrl(n,this.uri);_.setWcLinking({name:o,href:i}),_.setRecentWallet(this.wallet),R.openHref(r,"_blank")}catch{this.error=!0}}};bn([C()],_t.prototype,"isLoading",void 0);_t=bn([S("w3m-connecting-wc-web")],_t);const zi=B`
  :host([data-mobile-fullscreen='true']) {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  :host([data-mobile-fullscreen='true']) wui-ux-by-reown {
    margin-top: auto;
  }
`;var Ee=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let se=class extends k{constructor(){var t;super(),this.wallet=(t=E.state.data)==null?void 0:t.wallet,this.unsubscribe=[],this.platform=void 0,this.platforms=[],this.isSiwxEnabled=!!N.state.siwx,this.remoteFeatures=N.state.remoteFeatures,this.displayBranding=!0,this.basic=!1,this.determinePlatforms(),this.initializeConnection(),this.unsubscribe.push(N.subscribeKey("remoteFeatures",n=>this.remoteFeatures=n))}disconnectedCallback(){this.unsubscribe.forEach(t=>t())}render(){return N.state.enableMobileFullScreen&&this.setAttribute("data-mobile-fullscreen","true"),d`
      ${this.headerTemplate()}
      <div class="platform-container">${this.platformTemplate()}</div>
      ${this.reownBrandingTemplate()}
    `}reownBrandingTemplate(){var t;return!((t=this.remoteFeatures)!=null&&t.reownBranding)||!this.displayBranding?null:d`<wui-ux-by-reown></wui-ux-by-reown>`}async initializeConnection(t=!1){var n,o;if(!(this.platform==="browser"||N.state.manualWCControl&&!t))try{const{wcPairingExpiry:r,status:i}=_.state,{redirectView:s}=E.state.data??{};if(t||N.state.enableEmbedded||R.isPairingExpired(r)||i==="connecting"){const a=_.getConnections(de.state.activeChain),l=(n=this.remoteFeatures)==null?void 0:n.multiWallet,c=a.length>0;await _.connectWalletConnect({cache:"never"}),this.isSiwxEnabled||(c&&l?(E.replace("ProfileWallets"),Oe.showSuccess("New Wallet Added")):s?E.replace(s):Gt.close())}}catch(r){if(r instanceof Error&&r.message.includes("An error occurred when attempting to switch chain")&&!N.state.enableNetworkSwitch&&de.state.activeChain){de.setActiveCaipNetwork(En.getUnsupportedNetwork(`${de.state.activeChain}:${(o=de.state.activeCaipNetwork)==null?void 0:o.id}`)),de.showUnsupportedChainUI();return}r instanceof Yt&&r.originalName===Jt.PROVIDER_RPC_ERROR_NAME.USER_REJECTED_REQUEST?O.sendEvent({type:"track",event:"USER_REJECTED",properties:{message:r.message}}):O.sendEvent({type:"track",event:"CONNECT_ERROR",properties:{message:(r==null?void 0:r.message)??"Unknown"}}),_.setWcError(!0),Oe.showError(r.message??"Connection error"),_.resetWcConnection(),E.goBack()}}determinePlatforms(){if(!this.wallet){this.platforms.push("qrcode"),this.platform="qrcode";return}if(this.platform)return;const{mobile_link:t,desktop_link:n,webapp_link:o,injected:r,rdns:i}=this.wallet,s=r==null?void 0:r.map(({injected_id:$})=>$).filter(Boolean),a=[...i?[i]:s??[]],l=N.state.isUniversalProvider?!1:a.length,c=t,g=o,I=_.checkInstalled(a),v=l&&I,y=n&&!R.isMobile();v&&!de.state.noAdapters&&this.platforms.push("browser"),c&&this.platforms.push(R.isMobile()?"mobile":"qrcode"),g&&this.platforms.push("web"),y&&this.platforms.push("desktop"),!v&&l&&!de.state.noAdapters&&this.platforms.push("unsupported"),this.platform=this.platforms[0]}platformTemplate(){switch(this.platform){case"browser":return d`<w3m-connecting-wc-browser></w3m-connecting-wc-browser>`;case"web":return d`<w3m-connecting-wc-web></w3m-connecting-wc-web>`;case"desktop":return d`
          <w3m-connecting-wc-desktop .onRetry=${()=>this.initializeConnection(!0)}>
          </w3m-connecting-wc-desktop>
        `;case"mobile":return d`
          <w3m-connecting-wc-mobile isMobile .onRetry=${()=>this.initializeConnection(!0)}>
          </w3m-connecting-wc-mobile>
        `;case"qrcode":return d`<w3m-connecting-wc-qrcode ?basic=${this.basic}></w3m-connecting-wc-qrcode>`;default:return d`<w3m-connecting-wc-unsupported></w3m-connecting-wc-unsupported>`}}headerTemplate(){return this.platforms.length>1?d`
      <w3m-connecting-header
        .platforms=${this.platforms}
        .onSelectPlatfrom=${this.onSelectPlatform.bind(this)}
      >
      </w3m-connecting-header>
    `:null}async onSelectPlatform(t){var o;const n=(o=this.shadowRoot)==null?void 0:o.querySelector("div");n&&(await n.animate([{opacity:1},{opacity:0}],{duration:200,fill:"forwards",easing:"ease"}).finished,this.platform=t,n.animate([{opacity:0},{opacity:1}],{duration:200,fill:"forwards",easing:"ease"}))}};se.styles=zi;Ee([C()],se.prototype,"platform",void 0);Ee([C()],se.prototype,"platforms",void 0);Ee([C()],se.prototype,"isSiwxEnabled",void 0);Ee([C()],se.prototype,"remoteFeatures",void 0);Ee([u({type:Boolean})],se.prototype,"displayBranding",void 0);Ee([u({type:Boolean})],se.prototype,"basic",void 0);se=Ee([S("w3m-connecting-wc-view")],se);var Bt=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let et=class extends k{constructor(){super(),this.unsubscribe=[],this.isMobile=R.isMobile(),this.remoteFeatures=N.state.remoteFeatures,this.unsubscribe.push(N.subscribeKey("remoteFeatures",t=>this.remoteFeatures=t))}disconnectedCallback(){this.unsubscribe.forEach(t=>t())}render(){if(this.isMobile){const{featured:t,recommended:n}=T.state,{customWallets:o}=N.state,r=Rn.getRecentWallets(),i=t.length||n.length||(o==null?void 0:o.length)||r.length;return d`<wui-flex flexDirection="column" gap="2" .margin=${["1","3","3","3"]}>
        ${i?d`<w3m-connector-list></w3m-connector-list>`:null}
        <w3m-all-wallets-widget></w3m-all-wallets-widget>
      </wui-flex>`}return d`<wui-flex flexDirection="column" .padding=${["0","0","4","0"]}>
        <w3m-connecting-wc-view ?basic=${!0} .displayBranding=${!1}></w3m-connecting-wc-view>
        <wui-flex flexDirection="column" .padding=${["0","3","0","3"]}>
          <w3m-all-wallets-widget></w3m-all-wallets-widget>
        </wui-flex>
      </wui-flex>
      ${this.reownBrandingTemplate()} `}reownBrandingTemplate(){var t;return(t=this.remoteFeatures)!=null&&t.reownBranding?d` <wui-flex flexDirection="column" .padding=${["1","0","1","0"]}>
      <wui-ux-by-reown></wui-ux-by-reown>
    </wui-flex>`:null}};Bt([C()],et.prototype,"isMobile",void 0);Bt([C()],et.prototype,"remoteFeatures",void 0);et=Bt([S("w3m-connecting-wc-basic-view")],et);/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Di=e=>e.strings===void 0;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ne=(e,t)=>{var o;const n=e._$AN;if(n===void 0)return!1;for(const r of n)(o=r._$AO)==null||o.call(r,t,!1),Ne(r,t);return!0},tt=e=>{let t,n;do{if((t=e._$AM)===void 0)break;n=t._$AN,n.delete(e),e=t}while((n==null?void 0:n.size)===0)},yn=e=>{for(let t;t=e._$AM;e=t){let n=t._$AN;if(n===void 0)t._$AN=n=new Set;else if(n.has(e))break;n.add(e),Fi(t)}};function ji(e){this._$AN!==void 0?(tt(this),this._$AM=e,yn(this)):this._$AM=e}function Ui(e,t=!1,n=0){const o=this._$AH,r=this._$AN;if(r!==void 0&&r.size!==0)if(t)if(Array.isArray(o))for(let i=n;i<o.length;i++)Ne(o[i],!1),tt(o[i]);else o!=null&&(Ne(o,!1),tt(o));else Ne(this,e)}const Fi=e=>{e.type==Tn.CHILD&&(e._$AP??(e._$AP=Ui),e._$AQ??(e._$AQ=ji))};class Vi extends _n{constructor(){super(...arguments),this._$AN=void 0}_$AT(t,n,o){super._$AT(t,n,o),yn(this),this.isConnected=t._$AU}_$AO(t,n=!0){var o,r;t!==this.isConnected&&(this.isConnected=t,t?(o=this.reconnected)==null||o.call(this):(r=this.disconnected)==null||r.call(this)),n&&(Ne(this,t),tt(this))}setValue(t){if(Di(this._$Ct))this._$Ct._$AI(t,this);else{const n=[...this._$Ct._$AH];n[this._$Ci]=t,this._$Ct._$AI(n,this,0)}}disconnected(){}reconnected(){}}/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Pt=()=>new Hi;class Hi{}const yt=new WeakMap,Lt=Sn(class extends Vi{render(e){return Mt}update(e,[t]){var o;const n=t!==this.G;return n&&this.rt(void 0),(n||this.lt!==this.ct)&&(this.G=t,this.ht=(o=e.options)==null?void 0:o.host,this.rt(this.ct=e.element)),Mt}rt(e){if(this.G!==void 0)if(this.isConnected||(e=void 0),typeof this.G=="function"){const t=this.ht??globalThis;let n=yt.get(t);n===void 0&&(n=new WeakMap,yt.set(t,n)),n.get(this.G)!==void 0&&this.G.call(this.ht,void 0),n.set(this.G,e),e!==void 0&&this.G.call(this.ht,e)}else this.G.value=e}get lt(){var e,t;return typeof this.G=="function"?(e=yt.get(this.ht??globalThis))==null?void 0:e.get(this.G):(t=this.G)==null?void 0:t.value}disconnected(){this.lt===this.ct&&this.rt(void 0)}reconnected(){this.rt(this.ct)}}),Ki=B`
  :host {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  label {
    position: relative;
    display: inline-block;
    user-select: none;
    transition:
      background-color ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      color ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      border ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      box-shadow ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      width ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      height ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      transform ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      opacity ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]};
    will-change: background-color, color, border, box-shadow, width, height, transform, opacity;
  }

  input {
    width: 0;
    height: 0;
    opacity: 0;
  }

  span {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: ${({colors:e})=>e.neutrals300};
    border-radius: ${({borderRadius:e})=>e.round};
    border: 1px solid transparent;
    will-change: border;
    transition:
      background-color ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      color ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      border ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      box-shadow ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      width ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      height ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      transform ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      opacity ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]};
    will-change: background-color, color, border, box-shadow, width, height, transform, opacity;
  }

  span:before {
    content: '';
    position: absolute;
    background-color: ${({colors:e})=>e.white};
    border-radius: 50%;
  }

  /* -- Sizes --------------------------------------------------------- */
  label[data-size='lg'] {
    width: 48px;
    height: 32px;
  }

  label[data-size='md'] {
    width: 40px;
    height: 28px;
  }

  label[data-size='sm'] {
    width: 32px;
    height: 22px;
  }

  label[data-size='lg'] > span:before {
    height: 24px;
    width: 24px;
    left: 4px;
    top: 3px;
  }

  label[data-size='md'] > span:before {
    height: 20px;
    width: 20px;
    left: 4px;
    top: 3px;
  }

  label[data-size='sm'] > span:before {
    height: 16px;
    width: 16px;
    left: 3px;
    top: 2px;
  }

  /* -- Focus states --------------------------------------------------- */
  input:focus-visible:not(:checked) + span,
  input:focus:not(:checked) + span {
    border: 1px solid ${({tokens:e})=>e.core.iconAccentPrimary};
    background-color: ${({tokens:e})=>e.theme.textTertiary};
    box-shadow: 0px 0px 0px 4px rgba(9, 136, 240, 0.2);
  }

  input:focus-visible:checked + span,
  input:focus:checked + span {
    border: 1px solid ${({tokens:e})=>e.core.iconAccentPrimary};
    box-shadow: 0px 0px 0px 4px rgba(9, 136, 240, 0.2);
  }

  /* -- Checked states --------------------------------------------------- */
  input:checked + span {
    background-color: ${({tokens:e})=>e.core.iconAccentPrimary};
  }

  label[data-size='lg'] > input:checked + span:before {
    transform: translateX(calc(100% - 9px));
  }

  label[data-size='md'] > input:checked + span:before {
    transform: translateX(calc(100% - 9px));
  }

  label[data-size='sm'] > input:checked + span:before {
    transform: translateX(calc(100% - 7px));
  }

  /* -- Hover states ------------------------------------------------------- */
  label:hover > input:not(:checked):not(:disabled) + span {
    background-color: ${({colors:e})=>e.neutrals400};
  }

  label:hover > input:checked:not(:disabled) + span {
    background-color: ${({colors:e})=>e.accent080};
  }

  /* -- Disabled state --------------------------------------------------- */
  label:has(input:disabled) {
    pointer-events: none;
    user-select: none;
  }

  input:not(:checked):disabled + span {
    background-color: ${({colors:e})=>e.neutrals700};
  }

  input:checked:disabled + span {
    background-color: ${({colors:e})=>e.neutrals700};
  }

  input:not(:checked):disabled + span::before {
    background-color: ${({colors:e})=>e.neutrals400};
  }

  input:checked:disabled + span::before {
    background-color: ${({tokens:e})=>e.theme.textTertiary};
  }
`;var ut=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let ke=class extends k{constructor(){super(...arguments),this.inputElementRef=Pt(),this.checked=!1,this.disabled=!1,this.size="md"}render(){return d`
      <label data-size=${this.size}>
        <input
          ${Lt(this.inputElementRef)}
          type="checkbox"
          ?checked=${this.checked}
          ?disabled=${this.disabled}
          @change=${this.dispatchChangeEvent.bind(this)}
        />
        <span></span>
      </label>
    `}dispatchChangeEvent(){var t;this.dispatchEvent(new CustomEvent("switchChange",{detail:(t=this.inputElementRef.value)==null?void 0:t.checked,bubbles:!0,composed:!0}))}};ke.styles=[j,ae,Ki];ut([u({type:Boolean})],ke.prototype,"checked",void 0);ut([u({type:Boolean})],ke.prototype,"disabled",void 0);ut([u()],ke.prototype,"size",void 0);ke=ut([S("wui-toggle")],ke);const qi=B`
  :host {
    height: auto;
  }

  :host > wui-flex {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    column-gap: ${({spacing:e})=>e[2]};
    padding: ${({spacing:e})=>e[2]} ${({spacing:e})=>e[3]};
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    border-radius: ${({borderRadius:e})=>e[4]};
    box-shadow: inset 0 0 0 1px ${({tokens:e})=>e.theme.foregroundPrimary};
    transition: background-color ${({durations:e})=>e.lg}
      ${({easings:e})=>e["ease-out-power-2"]};
    will-change: background-color;
    cursor: pointer;
  }

  wui-switch {
    pointer-events: none;
  }
`;var $n=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let nt=class extends k{constructor(){super(...arguments),this.checked=!1}render(){return d`
      <wui-flex>
        <wui-icon size="xl" name="walletConnectBrown"></wui-icon>
        <wui-toggle
          ?checked=${this.checked}
          size="sm"
          @switchChange=${this.handleToggleChange.bind(this)}
        ></wui-toggle>
      </wui-flex>
    `}handleToggleChange(t){t.stopPropagation(),this.checked=t.detail,this.dispatchSwitchEvent()}dispatchSwitchEvent(){this.dispatchEvent(new CustomEvent("certifiedSwitchChange",{detail:this.checked,bubbles:!0,composed:!0}))}};nt.styles=[j,ae,qi];$n([u({type:Boolean})],nt.prototype,"checked",void 0);nt=$n([S("wui-certified-switch")],nt);const Gi=B`
  :host {
    position: relative;
    width: 100%;
    display: inline-flex;
    flex-direction: column;
    gap: ${({spacing:e})=>e[3]};
    color: ${({tokens:e})=>e.theme.textPrimary};
    caret-color: ${({tokens:e})=>e.core.textAccentPrimary};
  }

  .wui-input-text-container {
    position: relative;
    display: flex;
  }

  input {
    width: 100%;
    border-radius: ${({borderRadius:e})=>e[4]};
    color: inherit;
    background: transparent;
    border: 1px solid ${({tokens:e})=>e.theme.borderPrimary};
    caret-color: ${({tokens:e})=>e.core.textAccentPrimary};
    padding: ${({spacing:e})=>e[3]} ${({spacing:e})=>e[3]}
      ${({spacing:e})=>e[3]} ${({spacing:e})=>e[10]};
    font-size: ${({textSize:e})=>e.large};
    line-height: ${({typography:e})=>e["lg-regular"].lineHeight};
    letter-spacing: ${({typography:e})=>e["lg-regular"].letterSpacing};
    font-weight: ${({fontWeight:e})=>e.regular};
    font-family: ${({fontFamily:e})=>e.regular};
  }

  input[data-size='lg'] {
    padding: ${({spacing:e})=>e[4]} ${({spacing:e})=>e[3]}
      ${({spacing:e})=>e[4]} ${({spacing:e})=>e[10]};
  }

  @media (hover: hover) and (pointer: fine) {
    input:hover:enabled {
      border: 1px solid ${({tokens:e})=>e.theme.borderSecondary};
    }
  }

  input:disabled {
    cursor: unset;
    border: 1px solid ${({tokens:e})=>e.theme.borderPrimary};
  }

  input::placeholder {
    color: ${({tokens:e})=>e.theme.textSecondary};
  }

  input:focus:enabled {
    border: 1px solid ${({tokens:e})=>e.theme.borderSecondary};
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    -webkit-box-shadow: 0px 0px 0px 4px ${({tokens:e})=>e.core.foregroundAccent040};
    -moz-box-shadow: 0px 0px 0px 4px ${({tokens:e})=>e.core.foregroundAccent040};
    box-shadow: 0px 0px 0px 4px ${({tokens:e})=>e.core.foregroundAccent040};
  }

  div.wui-input-text-container:has(input:disabled) {
    opacity: 0.5;
  }

  wui-icon.wui-input-text-left-icon {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    left: ${({spacing:e})=>e[4]};
    color: ${({tokens:e})=>e.theme.iconDefault};
  }

  button.wui-input-text-submit-button {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    right: ${({spacing:e})=>e[3]};
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    border-radius: ${({borderRadius:e})=>e[2]};
    color: ${({tokens:e})=>e.core.textAccentPrimary};
  }

  button.wui-input-text-submit-button:disabled {
    opacity: 1;
  }

  button.wui-input-text-submit-button.loading wui-icon {
    animation: spin 1s linear infinite;
  }

  button.wui-input-text-submit-button:hover {
    background: ${({tokens:e})=>e.core.foregroundAccent010};
  }

  input:has(+ .wui-input-text-submit-button) {
    padding-right: ${({spacing:e})=>e[12]};
  }

  input[type='number'] {
    -moz-appearance: textfield;
  }

  input[type='search']::-webkit-search-decoration,
  input[type='search']::-webkit-search-cancel-button,
  input[type='search']::-webkit-search-results-button,
  input[type='search']::-webkit-search-results-decoration {
    -webkit-appearance: none;
  }

  /* -- Keyframes --------------------------------------------------- */
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;var H=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let M=class extends k{constructor(){super(...arguments),this.inputElementRef=Pt(),this.disabled=!1,this.loading=!1,this.placeholder="",this.type="text",this.value="",this.size="md"}render(){return d` <div class="wui-input-text-container">
        ${this.templateLeftIcon()}
        <input
          data-size=${this.size}
          ${Lt(this.inputElementRef)}
          data-testid="wui-input-text"
          type=${this.type}
          enterkeyhint=${A(this.enterKeyHint)}
          ?disabled=${this.disabled}
          placeholder=${this.placeholder}
          @input=${this.dispatchInputChangeEvent.bind(this)}
          @keydown=${this.onKeyDown}
          .value=${this.value||""}
        />
        ${this.templateSubmitButton()}
        <slot class="wui-input-text-slot"></slot>
      </div>
      ${this.templateError()} ${this.templateWarning()}`}templateLeftIcon(){return this.icon?d`<wui-icon
        class="wui-input-text-left-icon"
        size="md"
        data-size=${this.size}
        color="inherit"
        name=${this.icon}
      ></wui-icon>`:null}templateSubmitButton(){var t;return this.onSubmit?d`<button
        class="wui-input-text-submit-button ${this.loading?"loading":""}"
        @click=${(t=this.onSubmit)==null?void 0:t.bind(this)}
        ?disabled=${this.disabled||this.loading}
      >
        ${this.loading?d`<wui-icon name="spinner" size="md"></wui-icon>`:d`<wui-icon name="chevronRight" size="md"></wui-icon>`}
      </button>`:null}templateError(){return this.errorText?d`<wui-text variant="sm-regular" color="error">${this.errorText}</wui-text>`:null}templateWarning(){return this.warningText?d`<wui-text variant="sm-regular" color="warning">${this.warningText}</wui-text>`:null}dispatchInputChangeEvent(){var t;this.dispatchEvent(new CustomEvent("inputChange",{detail:(t=this.inputElementRef.value)==null?void 0:t.value,bubbles:!0,composed:!0}))}};M.styles=[j,ae,Gi];H([u()],M.prototype,"icon",void 0);H([u({type:Boolean})],M.prototype,"disabled",void 0);H([u({type:Boolean})],M.prototype,"loading",void 0);H([u()],M.prototype,"placeholder",void 0);H([u()],M.prototype,"type",void 0);H([u()],M.prototype,"value",void 0);H([u()],M.prototype,"errorText",void 0);H([u()],M.prototype,"warningText",void 0);H([u()],M.prototype,"onSubmit",void 0);H([u()],M.prototype,"size",void 0);H([u({attribute:!1})],M.prototype,"onKeyDown",void 0);M=H([S("wui-input-text")],M);const Yi=B`
  :host {
    position: relative;
    display: inline-block;
    width: 100%;
  }

  wui-icon {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    right: ${({spacing:e})=>e[3]};
    color: ${({tokens:e})=>e.theme.iconDefault};
    cursor: pointer;
    padding: ${({spacing:e})=>e[2]};
    background-color: transparent;
    border-radius: ${({borderRadius:e})=>e[4]};
    transition: background-color ${({durations:e})=>e.lg}
      ${({easings:e})=>e["ease-out-power-2"]};
  }

  @media (hover: hover) {
    wui-icon:hover {
      background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
    }
  }
`;var vn=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let it=class extends k{constructor(){super(...arguments),this.inputComponentRef=Pt(),this.inputValue=""}render(){return d`
      <wui-input-text
        ${Lt(this.inputComponentRef)}
        placeholder="Search wallet"
        icon="search"
        type="search"
        enterKeyHint="search"
        size="sm"
        @inputChange=${this.onInputChange}
      >
        ${this.inputValue?d`<wui-icon
              @click=${this.clearValue}
              color="inherit"
              size="sm"
              name="close"
            ></wui-icon>`:null}
      </wui-input-text>
    `}onInputChange(t){this.inputValue=t.detail||""}clearValue(){const t=this.inputComponentRef.value,n=t==null?void 0:t.inputElementRef.value;n&&(n.value="",this.inputValue="",n.focus(),n.dispatchEvent(new Event("input")))}};it.styles=[j,Yi];vn([u()],it.prototype,"inputValue",void 0);it=vn([S("wui-search-bar")],it);const Ji=Pe`<svg  viewBox="0 0 48 54" fill="none">
  <path
    d="M43.4605 10.7248L28.0485 1.61089C25.5438 0.129705 22.4562 0.129705 19.9515 1.61088L4.53951 10.7248C2.03626 12.2051 0.5 14.9365 0.5 17.886V36.1139C0.5 39.0635 2.03626 41.7949 4.53951 43.2752L19.9515 52.3891C22.4562 53.8703 25.5438 53.8703 28.0485 52.3891L43.4605 43.2752C45.9637 41.7949 47.5 39.0635 47.5 36.114V17.8861C47.5 14.9365 45.9637 12.2051 43.4605 10.7248Z"
  />
</svg>`,Qi=B`
  :host {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 104px;
    width: 104px;
    row-gap: ${({spacing:e})=>e[2]};
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    border-radius: ${({borderRadius:e})=>e[5]};
    position: relative;
  }

  wui-shimmer[data-type='network'] {
    border: none;
    -webkit-clip-path: var(--apkt-path-network);
    clip-path: var(--apkt-path-network);
  }

  svg {
    position: absolute;
    width: 48px;
    height: 54px;
    z-index: 1;
  }

  svg > path {
    stroke: ${({tokens:e})=>e.theme.foregroundSecondary};
    stroke-width: 1px;
  }

  @media (max-width: 350px) {
    :host {
      width: 100%;
    }
  }
`;var Cn=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let ot=class extends k{constructor(){super(...arguments),this.type="wallet"}render(){return d`
      ${this.shimmerTemplate()}
      <wui-shimmer width="80px" height="20px"></wui-shimmer>
    `}shimmerTemplate(){return this.type==="network"?d` <wui-shimmer data-type=${this.type} width="48px" height="54px"></wui-shimmer>
        ${Ji}`:d`<wui-shimmer width="56px" height="56px"></wui-shimmer>`}};ot.styles=[j,ae,Qi];Cn([u()],ot.prototype,"type",void 0);ot=Cn([S("wui-card-select-loader")],ot);const Xi=Xt`
  :host {
    display: grid;
    width: inherit;
    height: inherit;
  }
`;var K=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let z=class extends k{render(){return this.style.cssText=`
      grid-template-rows: ${this.gridTemplateRows};
      grid-template-columns: ${this.gridTemplateColumns};
      justify-items: ${this.justifyItems};
      align-items: ${this.alignItems};
      justify-content: ${this.justifyContent};
      align-content: ${this.alignContent};
      column-gap: ${this.columnGap&&`var(--apkt-spacing-${this.columnGap})`};
      row-gap: ${this.rowGap&&`var(--apkt-spacing-${this.rowGap})`};
      gap: ${this.gap&&`var(--apkt-spacing-${this.gap})`};
      padding-top: ${this.padding&&oe.getSpacingStyles(this.padding,0)};
      padding-right: ${this.padding&&oe.getSpacingStyles(this.padding,1)};
      padding-bottom: ${this.padding&&oe.getSpacingStyles(this.padding,2)};
      padding-left: ${this.padding&&oe.getSpacingStyles(this.padding,3)};
      margin-top: ${this.margin&&oe.getSpacingStyles(this.margin,0)};
      margin-right: ${this.margin&&oe.getSpacingStyles(this.margin,1)};
      margin-bottom: ${this.margin&&oe.getSpacingStyles(this.margin,2)};
      margin-left: ${this.margin&&oe.getSpacingStyles(this.margin,3)};
    `,d`<slot></slot>`}};z.styles=[j,Xi];K([u()],z.prototype,"gridTemplateRows",void 0);K([u()],z.prototype,"gridTemplateColumns",void 0);K([u()],z.prototype,"justifyItems",void 0);K([u()],z.prototype,"alignItems",void 0);K([u()],z.prototype,"justifyContent",void 0);K([u()],z.prototype,"alignContent",void 0);K([u()],z.prototype,"columnGap",void 0);K([u()],z.prototype,"rowGap",void 0);K([u()],z.prototype,"gap",void 0);K([u()],z.prototype,"padding",void 0);K([u()],z.prototype,"margin",void 0);z=K([S("wui-grid")],z);const Zi=B`
  button {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    width: 104px;
    row-gap: ${({spacing:e})=>e[2]};
    padding: ${({spacing:e})=>e[3]} ${({spacing:e})=>e[0]};
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    border-radius: clamp(0px, ${({borderRadius:e})=>e[4]}, 20px);
    transition:
      color ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-1"]},
      background-color ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-1"]},
      border-radius ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-1"]};
    will-change: background-color, color, border-radius;
    outline: none;
    border: none;
  }

  button > wui-flex > wui-text {
    color: ${({tokens:e})=>e.theme.textPrimary};
    max-width: 86px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    justify-content: center;
  }

  button > wui-flex > wui-text.certified {
    max-width: 66px;
  }

  @media (hover: hover) and (pointer: fine) {
    button:hover:enabled {
      background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
    }
  }

  button:disabled > wui-flex > wui-text {
    color: ${({tokens:e})=>e.core.glass010};
  }

  [data-selected='true'] {
    background-color: ${({colors:e})=>e.accent020};
  }

  @media (hover: hover) and (pointer: fine) {
    [data-selected='true']:hover:enabled {
      background-color: ${({colors:e})=>e.accent010};
    }
  }

  [data-selected='true']:active:enabled {
    background-color: ${({colors:e})=>e.accent010};
  }

  @media (max-width: 350px) {
    button {
      width: 100%;
    }
  }
`;var ee=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let F=class extends k{constructor(){super(),this.observer=new IntersectionObserver(()=>{}),this.visible=!1,this.imageSrc=void 0,this.imageLoading=!1,this.isImpressed=!1,this.explorerId="",this.walletQuery="",this.certified=!1,this.displayIndex=0,this.wallet=void 0,this.observer=new IntersectionObserver(t=>{t.forEach(n=>{n.isIntersecting?(this.visible=!0,this.fetchImageSrc(),this.sendImpressionEvent()):this.visible=!1})},{threshold:.01})}firstUpdated(){this.observer.observe(this)}disconnectedCallback(){this.observer.disconnect()}render(){var n,o;const t=((n=this.wallet)==null?void 0:n.badge_type)==="certified";return d`
      <button>
        ${this.imageTemplate()}
        <wui-flex flexDirection="row" alignItems="center" justifyContent="center" gap="1">
          <wui-text
            variant="md-regular"
            color="inherit"
            class=${A(t?"certified":void 0)}
            >${(o=this.wallet)==null?void 0:o.name}</wui-text
          >
          ${t?d`<wui-icon size="sm" name="walletConnectBrown"></wui-icon>`:null}
        </wui-flex>
      </button>
    `}imageTemplate(){var t,n;return!this.visible&&!this.imageSrc||this.imageLoading?this.shimmerTemplate():d`
      <wui-wallet-image
        size="lg"
        imageSrc=${A(this.imageSrc)}
        name=${A((t=this.wallet)==null?void 0:t.name)}
        .installed=${((n=this.wallet)==null?void 0:n.installed)??!1}
        badgeSize="sm"
      >
      </wui-wallet-image>
    `}shimmerTemplate(){return d`<wui-shimmer width="56px" height="56px"></wui-shimmer>`}async fetchImageSrc(){this.wallet&&(this.imageSrc=he.getWalletImage(this.wallet),!this.imageSrc&&(this.imageLoading=!0,this.imageSrc=await he.fetchWalletImage(this.wallet.image_id),this.imageLoading=!1))}sendImpressionEvent(){!this.wallet||this.isImpressed||(this.isImpressed=!0,O.sendWalletImpressionEvent({name:this.wallet.name,walletRank:this.wallet.order,explorerId:this.explorerId,view:E.state.view,query:this.walletQuery,certified:this.certified,displayIndex:this.displayIndex}))}};F.styles=Zi;ee([C()],F.prototype,"visible",void 0);ee([C()],F.prototype,"imageSrc",void 0);ee([C()],F.prototype,"imageLoading",void 0);ee([C()],F.prototype,"isImpressed",void 0);ee([u()],F.prototype,"explorerId",void 0);ee([u()],F.prototype,"walletQuery",void 0);ee([u()],F.prototype,"certified",void 0);ee([u()],F.prototype,"displayIndex",void 0);ee([u({type:Object})],F.prototype,"wallet",void 0);F=ee([S("w3m-all-wallets-list-item")],F);const eo=B`
  wui-grid {
    max-height: clamp(360px, 400px, 80vh);
    overflow: scroll;
    scrollbar-width: none;
    grid-auto-rows: min-content;
    grid-template-columns: repeat(auto-fill, 104px);
  }

  :host([data-mobile-fullscreen='true']) wui-grid {
    max-height: none;
  }

  @media (max-width: 350px) {
    wui-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  wui-grid[data-scroll='false'] {
    overflow: hidden;
  }

  wui-grid::-webkit-scrollbar {
    display: none;
  }

  w3m-all-wallets-list-item {
    opacity: 0;
    animation-duration: ${({durations:e})=>e.xl};
    animation-timing-function: ${({easings:e})=>e["ease-inout-power-2"]};
    animation-name: fade-in;
    animation-fill-mode: forwards;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  wui-loading-spinner {
    padding-top: ${({spacing:e})=>e[4]};
    padding-bottom: ${({spacing:e})=>e[4]};
    justify-content: center;
    grid-column: 1 / span 4;
  }
`;var ge=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};const Kt="local-paginator";let X=class extends k{constructor(){super(),this.unsubscribe=[],this.paginationObserver=void 0,this.loading=!T.state.wallets.length,this.wallets=T.state.wallets,this.recommended=T.state.recommended,this.featured=T.state.featured,this.filteredWallets=T.state.filteredWallets,this.mobileFullScreen=N.state.enableMobileFullScreen,this.unsubscribe.push(T.subscribeKey("wallets",t=>this.wallets=t),T.subscribeKey("recommended",t=>this.recommended=t),T.subscribeKey("featured",t=>this.featured=t),T.subscribeKey("filteredWallets",t=>this.filteredWallets=t))}firstUpdated(){this.initialFetch(),this.createPaginationObserver()}disconnectedCallback(){var t;this.unsubscribe.forEach(n=>n()),(t=this.paginationObserver)==null||t.disconnect()}render(){return this.mobileFullScreen&&this.setAttribute("data-mobile-fullscreen","true"),d`
      <wui-grid
        data-scroll=${!this.loading}
        .padding=${["0","3","3","3"]}
        gap="2"
        justifyContent="space-between"
      >
        ${this.loading?this.shimmerTemplate(16):this.walletsTemplate()}
        ${this.paginationLoaderTemplate()}
      </wui-grid>
    `}async initialFetch(){var n;this.loading=!0;const t=(n=this.shadowRoot)==null?void 0:n.querySelector("wui-grid");t&&(await T.fetchWalletsByPage({page:1}),await t.animate([{opacity:1},{opacity:0}],{duration:200,fill:"forwards",easing:"ease"}).finished,this.loading=!1,t.animate([{opacity:0},{opacity:1}],{duration:200,fill:"forwards",easing:"ease"}))}shimmerTemplate(t,n){return[...Array(t)].map(()=>d`
        <wui-card-select-loader type="wallet" id=${A(n)}></wui-card-select-loader>
      `)}getWallets(){var r;const t=[...this.featured,...this.recommended];((r=this.filteredWallets)==null?void 0:r.length)>0?t.push(...this.filteredWallets):t.push(...this.wallets);const n=R.uniqueBy(t,"id"),o=vt.markWalletsAsInstalled(n);return vt.markWalletsWithDisplayIndex(o)}walletsTemplate(){return this.getWallets().map((n,o)=>d`
        <w3m-all-wallets-list-item
          data-testid="wallet-search-item-${n.id}"
          @click=${()=>this.onConnectWallet(n)}
          .wallet=${n}
          explorerId=${n.id}
          certified=${this.badge==="certified"}
          displayIndex=${o}
        ></w3m-all-wallets-list-item>
      `)}paginationLoaderTemplate(){const{wallets:t,recommended:n,featured:o,count:r,mobileFilteredOutWalletsLength:i}=T.state,s=window.innerWidth<352?3:4,a=t.length+n.length;let c=Math.ceil(a/s)*s-a+s;return c-=t.length?o.length%s:0,r===0&&o.length>0?null:r===0||[...o,...t,...n].length<r-(i??0)?this.shimmerTemplate(c,Kt):null}createPaginationObserver(){var n;const t=(n=this.shadowRoot)==null?void 0:n.querySelector(`#${Kt}`);t&&(this.paginationObserver=new IntersectionObserver(([o])=>{if(o!=null&&o.isIntersecting&&!this.loading){const{page:r,count:i,wallets:s}=T.state;s.length<i&&T.fetchWalletsByPage({page:r+1})}}),this.paginationObserver.observe(t))}onConnectWallet(t){D.selectWalletConnector(t)}};X.styles=eo;ge([C()],X.prototype,"loading",void 0);ge([C()],X.prototype,"wallets",void 0);ge([C()],X.prototype,"recommended",void 0);ge([C()],X.prototype,"featured",void 0);ge([C()],X.prototype,"filteredWallets",void 0);ge([C()],X.prototype,"badge",void 0);ge([C()],X.prototype,"mobileFullScreen",void 0);X=ge([S("w3m-all-wallets-list")],X);const to=Xt`
  wui-grid,
  wui-loading-spinner,
  wui-flex {
    height: 360px;
  }

  wui-grid {
    overflow: scroll;
    scrollbar-width: none;
    grid-auto-rows: min-content;
    grid-template-columns: repeat(auto-fill, 104px);
  }

  :host([data-mobile-fullscreen='true']) wui-grid {
    max-height: none;
    height: auto;
  }

  wui-grid[data-scroll='false'] {
    overflow: hidden;
  }

  wui-grid::-webkit-scrollbar {
    display: none;
  }

  wui-loading-spinner {
    justify-content: center;
    align-items: center;
  }

  @media (max-width: 350px) {
    wui-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
`;var Ve=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let Ce=class extends k{constructor(){super(...arguments),this.prevQuery="",this.prevBadge=void 0,this.loading=!0,this.mobileFullScreen=N.state.enableMobileFullScreen,this.query=""}render(){return this.mobileFullScreen&&this.setAttribute("data-mobile-fullscreen","true"),this.onSearch(),this.loading?d`<wui-loading-spinner color="accent-primary"></wui-loading-spinner>`:this.walletsTemplate()}async onSearch(){(this.query.trim()!==this.prevQuery.trim()||this.badge!==this.prevBadge)&&(this.prevQuery=this.query,this.prevBadge=this.badge,this.loading=!0,await T.searchWallet({search:this.query,badge:this.badge}),this.loading=!1)}walletsTemplate(){const{search:t}=T.state,n=vt.markWalletsAsInstalled(t);return t.length?d`
      <wui-grid
        data-testid="wallet-list"
        .padding=${["0","3","3","3"]}
        rowGap="4"
        columngap="2"
        justifyContent="space-between"
      >
        ${n.map((o,r)=>d`
            <w3m-all-wallets-list-item
              @click=${()=>this.onConnectWallet(o)}
              .wallet=${o}
              data-testid="wallet-search-item-${o.id}"
              explorerId=${o.id}
              certified=${this.badge==="certified"}
              walletQuery=${this.query}
              displayIndex=${r}
            ></w3m-all-wallets-list-item>
          `)}
      </wui-grid>
    `:d`
        <wui-flex
          data-testid="no-wallet-found"
          justifyContent="center"
          alignItems="center"
          gap="3"
          flexDirection="column"
        >
          <wui-icon-box size="lg" color="default" icon="wallet"></wui-icon-box>
          <wui-text data-testid="no-wallet-found-text" color="secondary" variant="md-medium">
            No Wallet found
          </wui-text>
        </wui-flex>
      `}onConnectWallet(t){D.selectWalletConnector(t)}};Ce.styles=to;Ve([C()],Ce.prototype,"loading",void 0);Ve([C()],Ce.prototype,"mobileFullScreen",void 0);Ve([u()],Ce.prototype,"query",void 0);Ve([u()],Ce.prototype,"badge",void 0);Ce=Ve([S("w3m-all-wallets-search")],Ce);var Nt=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let rt=class extends k{constructor(){super(...arguments),this.search="",this.badge=void 0,this.onDebouncedSearch=R.debounce(t=>{this.search=t})}render(){const t=this.search.length>=2;return d`
      <wui-flex .padding=${["1","3","3","3"]} gap="2" alignItems="center">
        <wui-search-bar @inputChange=${this.onInputChange.bind(this)}></wui-search-bar>
        <wui-certified-switch
          ?checked=${this.badge==="certified"}
          @certifiedSwitchChange=${this.onCertifiedSwitchChange.bind(this)}
          data-testid="wui-certified-switch"
        ></wui-certified-switch>
        ${this.qrButtonTemplate()}
      </wui-flex>
      ${t||this.badge?d`<w3m-all-wallets-search
            query=${this.search}
            .badge=${this.badge}
          ></w3m-all-wallets-search>`:d`<w3m-all-wallets-list .badge=${this.badge}></w3m-all-wallets-list>`}
    `}onInputChange(t){this.onDebouncedSearch(t.detail)}onCertifiedSwitchChange(t){t.detail?(this.badge="certified",Oe.showSvg("Only WalletConnect certified",{icon:"walletConnectBrown",iconColor:"accent-100"})):this.badge=void 0}qrButtonTemplate(){return R.isMobile()?d`
        <wui-icon-box
          size="xl"
          iconSize="xl"
          color="accent-primary"
          icon="qrCode"
          border
          borderColor="wui-accent-glass-010"
          @click=${this.onWalletConnectQr.bind(this)}
        ></wui-icon-box>
      `:null}onWalletConnectQr(){E.push("ConnectingWalletConnect")}};Nt([C()],rt.prototype,"search",void 0);Nt([C()],rt.prototype,"badge",void 0);rt=Nt([S("w3m-all-wallets-view")],rt);const no=B`
  :host {
    width: 100%;
  }

  button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${({spacing:e})=>e[3]};
    width: 100%;
    background-color: ${({tokens:e})=>e.theme.backgroundPrimary};
    border-radius: ${({borderRadius:e})=>e[4]};
    transition:
      background-color ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      scale ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]};
    will-change: background-color, scale;
  }

  wui-text {
    text-transform: capitalize;
  }

  wui-image {
    color: ${({tokens:e})=>e.theme.textPrimary};
  }

  @media (hover: hover) {
    button:hover:enabled {
      background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    }
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;var te=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let V=class extends k{constructor(){super(...arguments),this.imageSrc="google",this.loading=!1,this.disabled=!1,this.rightIcon=!0,this.rounded=!1,this.fullSize=!1}render(){return this.dataset.rounded=this.rounded?"true":"false",d`
      <button
        ?disabled=${this.loading?!0:!!this.disabled}
        data-loading=${this.loading}
        tabindex=${A(this.tabIdx)}
      >
        <wui-flex gap="2" alignItems="center">
          ${this.templateLeftIcon()}
          <wui-flex gap="1">
            <slot></slot>
          </wui-flex>
        </wui-flex>
        ${this.templateRightIcon()}
      </button>
    `}templateLeftIcon(){return this.icon?d`<wui-image
        icon=${this.icon}
        iconColor=${A(this.iconColor)}
        ?boxed=${!0}
        ?rounded=${this.rounded}
      ></wui-image>`:d`<wui-image
      ?boxed=${!0}
      ?rounded=${this.rounded}
      ?fullSize=${this.fullSize}
      src=${this.imageSrc}
    ></wui-image>`}templateRightIcon(){return this.rightIcon?this.loading?d`<wui-loading-spinner size="md" color="accent-primary"></wui-loading-spinner>`:d`<wui-icon name="chevronRight" size="lg" color="default"></wui-icon>`:null}};V.styles=[j,ae,no];te([u()],V.prototype,"imageSrc",void 0);te([u()],V.prototype,"icon",void 0);te([u()],V.prototype,"iconColor",void 0);te([u({type:Boolean})],V.prototype,"loading",void 0);te([u()],V.prototype,"tabIdx",void 0);te([u({type:Boolean})],V.prototype,"disabled",void 0);te([u({type:Boolean})],V.prototype,"rightIcon",void 0);te([u({type:Boolean})],V.prototype,"rounded",void 0);te([u({type:Boolean})],V.prototype,"fullSize",void 0);V=te([S("wui-list-item")],V);var io=function(e,t,n,o){var r=arguments.length,i=r<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,n):o,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(e,t,n,o);else for(var a=e.length-1;a>=0;a--)(s=e[a])&&(i=(r<3?s(i):r>3?s(t,n,i):s(t,n))||i);return r>3&&i&&Object.defineProperty(t,n,i),i};let qt=class extends k{constructor(){var t;super(...arguments),this.wallet=(t=E.state.data)==null?void 0:t.wallet}render(){if(!this.wallet)throw new Error("w3m-downloads-view");return d`
      <wui-flex gap="2" flexDirection="column" .padding=${["3","3","4","3"]}>
        ${this.chromeTemplate()} ${this.iosTemplate()} ${this.androidTemplate()}
        ${this.homepageTemplate()}
      </wui-flex>
    `}chromeTemplate(){var t;return(t=this.wallet)!=null&&t.chrome_store?d`<wui-list-item
      variant="icon"
      icon="chromeStore"
      iconVariant="square"
      @click=${this.onChromeStore.bind(this)}
      chevron
    >
      <wui-text variant="md-medium" color="primary">Chrome Extension</wui-text>
    </wui-list-item>`:null}iosTemplate(){var t;return(t=this.wallet)!=null&&t.app_store?d`<wui-list-item
      variant="icon"
      icon="appStore"
      iconVariant="square"
      @click=${this.onAppStore.bind(this)}
      chevron
    >
      <wui-text variant="md-medium" color="primary">iOS App</wui-text>
    </wui-list-item>`:null}androidTemplate(){var t;return(t=this.wallet)!=null&&t.play_store?d`<wui-list-item
      variant="icon"
      icon="playStore"
      iconVariant="square"
      @click=${this.onPlayStore.bind(this)}
      chevron
    >
      <wui-text variant="md-medium" color="primary">Android App</wui-text>
    </wui-list-item>`:null}homepageTemplate(){var t;return(t=this.wallet)!=null&&t.homepage?d`
      <wui-list-item
        variant="icon"
        icon="browser"
        iconVariant="square-blue"
        @click=${this.onHomePage.bind(this)}
        chevron
      >
        <wui-text variant="md-medium" color="primary">Website</wui-text>
      </wui-list-item>
    `:null}openStore(t){t.href&&this.wallet&&(O.sendEvent({type:"track",event:"GET_WALLET",properties:{name:this.wallet.name,walletRank:this.wallet.order,explorerId:this.wallet.id,type:t.type}}),R.openHref(t.href,"_blank"))}onChromeStore(){var t;(t=this.wallet)!=null&&t.chrome_store&&this.openStore({href:this.wallet.chrome_store,type:"chrome_store"})}onAppStore(){var t;(t=this.wallet)!=null&&t.app_store&&this.openStore({href:this.wallet.app_store,type:"app_store"})}onPlayStore(){var t;(t=this.wallet)!=null&&t.play_store&&this.openStore({href:this.wallet.play_store,type:"play_store"})}onHomePage(){var t;(t=this.wallet)!=null&&t.homepage&&this.openStore({href:this.wallet.homepage,type:"homepage"})}};qt=io([S("w3m-downloads-view")],qt);export{rt as W3mAllWalletsView,et as W3mConnectingWcBasicView,qt as W3mDownloadsView};
