const HOME_HERO_SECTION_PATTERN =
  /<section class="section hero-home-section">[\s\S]*?<\/section>/;

export const X29_HOME_HERO_MEDIA = {
  landscapeMp4Url:
    "https://pub-a05e3eced20c4330baf5fb0f632f2d5f.r2.dev/hero/home/landscape.mp4",
  portraitMp4Url:
    "https://pub-a05e3eced20c4330baf5fb0f632f2d5f.r2.dev/hero/home/portrait.mp4",
  landscapePosterUrl: "/x29/media/home-hero-landscape-poster.jpg",
  portraitPosterUrl: "/x29/media/home-hero-portrait-poster.jpg",
  portraitMaxWidth: 767,
} as const;

function renderHomeHeroSection() {
  const mediaConfigJson = JSON.stringify(X29_HOME_HERO_MEDIA).replace(
    /</g,
    "\\u003c",
  );

  return `<section class="section hero-home-section"><div data-home-hero="" data-poster-url="${X29_HOME_HERO_MEDIA.landscapePosterUrl}" data-video-urls="${X29_HOME_HERO_MEDIA.landscapeMp4Url}" data-autoplay="true" data-loop="true" data-wf-ignore="true" class="video-home-hero w-background-video w-background-video-atom"><video id="x29-home-hero-video" autoplay="" loop="" poster="${X29_HOME_HERO_MEDIA.landscapePosterUrl}" style="background-image:url(&quot;${X29_HOME_HERO_MEDIA.landscapePosterUrl}&quot;)" muted="" playsinline="" preload="metadata" data-wf-ignore="true" data-object-fit="cover"></video><script type="text/javascript">(function(){const config=${mediaConfigJson};const wrapper=document.querySelector("[data-home-hero]");const video=document.getElementById("x29-home-hero-video");if(!wrapper||!(video instanceof HTMLVideoElement)){return;}let currentVariant="";const orientationQuery=window.matchMedia("(orientation: portrait)");const variants={landscape:{mp4Url:config.landscapeMp4Url,posterUrl:config.landscapePosterUrl},portrait:{mp4Url:config.portraitMp4Url,posterUrl:config.portraitPosterUrl}};const getVariant=()=>orientationQuery.matches||window.innerWidth<=config.portraitMaxWidth?"portrait":"landscape";const applyVariant=()=>{const nextVariant=getVariant();if(nextVariant===currentVariant){return;}currentVariant=nextVariant;const nextMedia=variants[nextVariant];wrapper.dataset.posterUrl=nextMedia.posterUrl;wrapper.dataset.videoUrls=nextMedia.mp4Url;video.poster=nextMedia.posterUrl;video.style.backgroundImage='url("'+nextMedia.posterUrl+'")';while(video.firstChild){video.removeChild(video.firstChild);}const source=document.createElement("source");source.src=nextMedia.mp4Url;source.type="video/mp4";source.dataset.wfIgnore="true";video.appendChild(source);video.load();const playPromise=video.play();if(playPromise&&typeof playPromise.catch==="function"){playPromise.catch(function(){});}};const onChange=()=>window.requestAnimationFrame(applyVariant);applyVariant();window.addEventListener("resize",onChange,{passive:true});if(typeof orientationQuery.addEventListener==="function"){orientationQuery.addEventListener("change",onChange);}else if(typeof orientationQuery.addListener==="function"){orientationQuery.addListener(onChange);}})();</script><div class="w-layout-blockcontainer main-container w-container"><div class="home-hero-wrap"><div class="headline-home-hero"><h1>An Experimental Lab for AI-Native Enterprise.</h1><a href="/contact" button="" data-wf--cta-main--variant="base" class="cta-main w-inline-block"><div class="button-text-mask"><div button-text="" class="button-text">Contact Us</div></div><div button-bg="" class="button-bg"></div></a></div><div class="home-hero-bottom-tile"><div class="label-small text-light-48">Port Co:&nbsp;<br/>Conducting AI</div><div class="text-align-right label-small text-light-48">Special<br/>Projects</div></div></div></div></div></section>`;
}

export function applyX29HomeHeroOverride(route: string, bodyHtml: string) {
  if (route !== "/" || !HOME_HERO_SECTION_PATTERN.test(bodyHtml)) {
    return bodyHtml;
  }

  return bodyHtml.replace(HOME_HERO_SECTION_PATTERN, renderHomeHeroSection());
}
