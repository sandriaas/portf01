const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/WistiaPlayerWrapper-6MYR7JP6-B8-qyW_z.js","assets/clarity-MEz6LakL.js","assets/chunk-EPOLDU6W-2aTxbjFE.js"])))=>i.map(i=>d[i]);
import{_ as v}from"./clarity-MEz6LakL.js";import{a as c,p as d}from"./chunk-EPOLDU6W-2aTxbjFE.js";var g=t=>t===null,O=t=>t===void 0,_=t=>g(t)||O(t),r=t=>!_(t),u=t=>typeof t=="string",$=t=>typeof t=="number",N=t=>r(t)&&typeof t=="function",j=t=>r(t)&&typeof t=="boolean",p=t=>$(t)||u(t)||j(t),x=(t,a,i)=>{let e=i;return typeof window>"u"||(r(window.wistiaOptions?._all)&&r(window.wistiaOptions._all[a])&&p(window.wistiaOptions._all[a])&&(e=window.wistiaOptions._all[a]),r(window.wistiaOptions?.[t])&&r(window.wistiaOptions[t])&&p(window.wistiaOptions[t][a])&&(e=window.wistiaOptions[t][a])),e},m=t=>t.replace(/[A-Z]+(?![a-z])|[A-Z]/g,(a,i)=>(i!==0?"-":"")+a.toLowerCase()),E=async t=>{const a=new Image;return a.src=t,await a.decode(),a},f=(t,a)=>`https://${a}/embed/medias/${t}/swatch`,R=async(t,a="fast.wistia.com")=>{const i=await E(f(t,a)),{naturalHeight:e,naturalWidth:n}=i;return n/e},P=({mediaId:t,embedHost:a="fast.wistia.com",aspect:i=1.7,shouldLoadSwatch:e=!0,roundedPlayer:n=0})=>{const s={background:e?`center / contain no-repeat url(${f(t,a)})`:void 0,borderRadius:`${n}px`,display:"block",filter:"blur(5px)",paddingTop:`${100/i}%`};return`
    wistia-player[media-id='${t}']:not(:defined) {
      ${Object.entries(s).map(([o,l])=>`${m(o)}: ${l};`).join(`\r
`)}
    }

    wistia-player[media-id='${t}']:state(--initializing) {
      ${Object.entries(s).map(([o,l])=>`${m(o)}: ${l};`).join(`\r
`)}
    }
  `};/*! Bundled license information:

@wistia/type-guards/dist/index.mjs:
  (*
   * @license @wistia/type-guards v0.9.3
   *
   * Copyright (c) 2023-2025, Wistia, Inc. and its affiliates.
   *
   * This source code is unlicensed, all rights reserved.
   *)
*/var S=c.lazy(async()=>v(()=>import("./WistiaPlayerWrapper-6MYR7JP6-B8-qyW_z.js"),__vite__mapDeps([0,1,2])).then(t=>({default:t.WistiaPlayerWrapper}))),W=c.forwardRef((t,a)=>{const{aspect:i,children:e,embedHost:n,mediaId:s,swatch:o,style:l}=t,w=x(s,"embedHost",n??void 0),b=u(w)?w:"fast.wistia.com",y=i!==void 0,h=P({mediaId:s,embedHost:b,aspect:i,shouldLoadSwatch:o});return d.jsx(c.Suspense,{fallback:y?d.jsxs(c.Fragment,{children:[d.jsx("style",{children:h}),d.jsx("wistia-player",{"media-id":s,style:l,children:e})]}):null,children:d.jsx(S,{ref:a,...t})})});const z=Object.freeze(Object.defineProperty({__proto__:null,WistiaPlayer:W},Symbol.toStringTag,{value:"Module"}));export{z as W,R as a,p as b,m as c,N as d,x as g,u as i,P as w};
