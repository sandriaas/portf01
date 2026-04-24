const HOME_HERO_SECTION_PATTERN =
  /<section class="section hero-home-section">[\s\S]*?<\/section>/;

const X29_HOME_HERO_MEDIA_VERSION = "20260424a";
const X29_HOME_HERO_R2_BASE_URL =
  "https://pub-a05e3eced20c4330baf5fb0f632f2d5f.r2.dev/hero/home";

function withVersion(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${X29_HOME_HERO_MEDIA_VERSION}`;
}

export const X29_HOME_HERO_BUCKET_OBJECTS = {
  landscape: {
    key: "hero/home/landscape.mp4",
    fallbackUrl: `${X29_HOME_HERO_R2_BASE_URL}/landscape.mp4`,
  },
  portrait: {
    key: "hero/home/portrait.mp4",
    fallbackUrl: `${X29_HOME_HERO_R2_BASE_URL}/portrait.mp4`,
  },
} as const;

export const X29_HOME_HERO_MEDIA = {
  landscapeMp4Url: withVersion("/x29/media/hero/home/landscape.mp4"),
  portraitMp4Url: withVersion("/x29/media/hero/home/portrait.mp4"),
  landscapePosterUrl: withVersion("/x29/media/home-hero-landscape-poster.jpg"),
  portraitPosterUrl: withVersion("/x29/media/home-hero-portrait-poster.jpg"),
  portraitMaxWidth: 767,
} as const;

function renderHomeHeroStyles() {
  return `<style>.x29-home-hero-media{padding-top:var(--_spacing---spacing--top-padding);padding-bottom:var(--_spacing---spacing--32);border-radius:var(--radius--radius-3);background-color:#000;color:var(--_colors---color--light);width:100%;min-height:calc(100vh - (var(--_spacing---spacing--8) * 2));display:flex;position:relative;overflow:hidden;isolation:isolate;}.x29-home-hero-stack{position:absolute;inset:0;z-index:0;background:#000;}.x29-home-hero-video,.x29-home-hero-poster{width:100%;height:100%;object-fit:cover;position:absolute;inset:0;}.x29-home-hero-video{background-position:50%;background-size:cover;}.x29-home-hero-poster{z-index:1;opacity:1;transition:opacity .28s ease;pointer-events:none;}.x29-home-hero-media[data-home-hero-state="video"] .x29-home-hero-poster{opacity:0;}.x29-home-hero-content{z-index:2;position:relative;display:flex;}@media screen and (max-width:767px){.x29-home-hero-media{min-height:calc(100vh - (var(--_spacing---spacing--8) * 2));}}</style>`;
}

function renderHomeHeroScript() {
  const mediaConfigJson = JSON.stringify(X29_HOME_HERO_MEDIA).replace(
    /</g,
    "\\u003c",
  );

  return `<script type="text/javascript">(function(){const config=${mediaConfigJson};const wrapper=document.querySelector("[data-home-hero]");const video=document.getElementById("x29-home-hero-video");const poster=document.getElementById("x29-home-hero-poster");if(!wrapper||!(video instanceof HTMLVideoElement)||!(poster instanceof HTMLImageElement)){return;}const orientationQuery=window.matchMedia("(orientation: portrait)");const variants={landscape:{mp4Url:config.landscapeMp4Url,posterUrl:config.landscapePosterUrl},portrait:{mp4Url:config.portraitMp4Url,posterUrl:config.portraitPosterUrl}};let currentVariant="";let canplayRetried=false;let interactionRetried=false;let interactionListenerAttached=false;const warn=(message,error)=>{try{console.warn("[x29-home-hero] "+message,error||"");}catch(_error){}};const setState=(state)=>{wrapper.dataset.homeHeroState=state;};const chooseVariant=()=>orientationQuery.matches||window.innerWidth<=config.portraitMaxWidth?"portrait":"landscape";const normalizeVideoElement=()=>{video.autoplay=true;video.controls=false;video.loop=true;video.muted=true;video.defaultMuted=true;video.volume=0;video.playsInline=true;video.preload="auto";if("disablePictureInPicture"in video){video.disablePictureInPicture=true;}video.setAttribute("autoplay","");video.setAttribute("loop","");video.setAttribute("muted","");video.setAttribute("playsinline","");video.setAttribute("webkit-playsinline","");video.setAttribute("disablepictureinpicture","");video.setAttribute("disableremoteplayback","");video.setAttribute("x-webkit-airplay","deny");video.setAttribute("data-wf-ignore","true");};const detachInteractionRetry=()=>{if(!interactionListenerAttached){return;}window.removeEventListener("touchstart",handleInteractionRetry);window.removeEventListener("pointerdown",handleInteractionRetry);interactionListenerAttached=false;};const attachInteractionRetry=()=>{if(interactionListenerAttached||interactionRetried){return;}interactionListenerAttached=true;window.addEventListener("touchstart",handleInteractionRetry,{passive:true});window.addEventListener("pointerdown",handleInteractionRetry,{passive:true});};const attemptPlay=(reason)=>{normalizeVideoElement();setState("loading");const playPromise=video.play();if(playPromise&&typeof playPromise.catch==="function"){playPromise.catch((error)=>{setState("fallback");warn("play() failed ("+reason+")",error);attachInteractionRetry();});}};function handleInteractionRetry(){if(interactionRetried){return;}interactionRetried=true;detachInteractionRetry();attemptPlay("user-interaction");}const applyVariant=(force)=>{const nextVariant=chooseVariant();if(!force&&nextVariant===currentVariant){return;}currentVariant=nextVariant;canplayRetried=false;interactionRetried=false;detachInteractionRetry();const nextMedia=variants[nextVariant];wrapper.dataset.homeHeroVariant=nextVariant;wrapper.dataset.posterUrl=nextMedia.posterUrl;wrapper.dataset.videoUrl=nextMedia.mp4Url;setState("poster");poster.src=nextMedia.posterUrl;video.poster=nextMedia.posterUrl;video.style.backgroundImage='url("'+nextMedia.posterUrl+'")';if(video.currentSrc!==nextMedia.mp4Url&&video.src!==nextMedia.mp4Url){video.src=nextMedia.mp4Url;}video.load();attemptPlay("variant-change");};video.addEventListener("loadeddata",()=>{if(wrapper.dataset.homeHeroState==="poster"){setState("loading");}});video.addEventListener("canplay",()=>{if(wrapper.dataset.homeHeroState==="video"||canplayRetried){return;}canplayRetried=true;attemptPlay("canplay");});video.addEventListener("playing",()=>{setState("video");detachInteractionRetry();});video.addEventListener("timeupdate",()=>{if(video.currentTime>0&&wrapper.dataset.homeHeroState!=="video"){setState("video");detachInteractionRetry();}});video.addEventListener("error",()=>{setState("fallback");warn("video error",video.error);attachInteractionRetry();});const onChange=()=>window.requestAnimationFrame(()=>applyVariant(false));normalizeVideoElement();applyVariant(true);window.addEventListener("resize",onChange,{passive:true});if(typeof orientationQuery.addEventListener==="function"){orientationQuery.addEventListener("change",onChange);}else if(typeof orientationQuery.addListener==="function"){orientationQuery.addListener(onChange);}})();</script>`;
}

function renderHomeHeroSection() {
  return `<section class="section hero-home-section">${renderHomeHeroStyles()}<div data-home-hero="" data-home-hero-state="poster" data-poster-url="${X29_HOME_HERO_MEDIA.landscapePosterUrl}" data-video-url="${X29_HOME_HERO_MEDIA.landscapeMp4Url}" class="x29-home-hero-media"><div class="x29-home-hero-stack"><video id="x29-home-hero-video" autoplay="" loop="" muted="" playsinline="" webkit-playsinline="" preload="auto" poster="${X29_HOME_HERO_MEDIA.landscapePosterUrl}" src="${X29_HOME_HERO_MEDIA.landscapeMp4Url}" aria-hidden="true" class="x29-home-hero-video"></video><img id="x29-home-hero-poster" src="${X29_HOME_HERO_MEDIA.landscapePosterUrl}" alt="" decoding="async" fetchpriority="high" class="x29-home-hero-poster"/></div>${renderHomeHeroScript()}<div class="w-layout-blockcontainer main-container w-container x29-home-hero-content"><div class="home-hero-wrap"><div class="headline-home-hero"><h1>An Experimental Lab for AI-Native Enterprise.</h1><a href="/contact" button="" data-wf--cta-main--variant="base" class="cta-main w-inline-block"><div class="button-text-mask"><div button-text="" class="button-text">Contact Us</div></div><div button-bg="" class="button-bg"></div></a></div><div class="home-hero-bottom-tile"><div class="label-small text-light-48">Port Co:&nbsp;<br/>Conducting AI</div><div class="text-align-right label-small text-light-48">Special<br/>Projects</div></div></div></div></div></section>`;
}

export function applyX29HomeHeroOverride(route: string, bodyHtml: string) {
  if (route !== "/" || !HOME_HERO_SECTION_PATTERN.test(bodyHtml)) {
    return bodyHtml;
  }

  return bodyHtml.replace(HOME_HERO_SECTION_PATTERN, renderHomeHeroSection());
}
