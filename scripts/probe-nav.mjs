import { chromium } from "playwright";
const URL = "https://oregea.vonzbern.workers.dev/";
const browser = await chromium.launch({ headless: true });
for (const vp of [{name:"desktop",w:1440,h:900},{name:"mobile",w:390,h:844}]) {
  const ctx = await browser.newContext({viewport:{width:vp.w,height:vp.h}});
  const page = await ctx.newPage();
  await page.goto(URL, {waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForLoadState("networkidle",{timeout:15000}).catch(()=>{});
  await page.waitForTimeout(1500);
  const data = await page.evaluate(()=>{
    const sels=[".master-navigation",".navbar",".nav-container",".master-nav",".left-nav",".menu-button",".brand-nav",".logo-nav",".cta-small"];
    const out={};
    for (const s of sels) {
      const el=document.querySelector(s);
      if(!el){out[s]="missing";continue;}
      const r=el.getBoundingClientRect();
      const cs=getComputedStyle(el);
      out[s]={x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),overflow:cs.overflow,padding:cs.padding,maxWidth:cs.maxWidth,flexShrink:cs.flexShrink,objectFit:cs.objectFit};
    }
    return out;
  });
  console.log("\n===",vp.name,"===");
  for(const [k,v] of Object.entries(data)) console.log(" ",k.padEnd(20),JSON.stringify(v));
  await ctx.close();
}
await browser.close();
