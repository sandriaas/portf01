#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const HTML_FILE = path.join(PUBLIC_DIR, 'shopify-design', 'index.html');
const OXYGEN_ASSET_DIR = path.join(
  PUBLIC_DIR,
  'cdn.shopify.com',
  'oxygen-v2',
  '53091',
  '115564',
  '237336',
  '3308732',
  'assets',
);
const INDEX_BUNDLE_FILE = path.join(OXYGEN_ASSET_DIR, '_index-DATvhclo.js');
const INDEX_STYLE_FILE = path.join(OXYGEN_ASSET_DIR, '_index-d1PKX52d.css');
const ENABLE_LOADING_FALLBACK = process.env.SHOPIFY_ENABLE_LOADING_FALLBACK === '1';
const INTRO_READY_MIN_DURATION_MS = 1500;
const EXTRA_RUNTIME_URLS = [
  'https://cdn.shopify.com/oxygen-v2/53091/115564/237336/3308732/assets/manifest-9719090d.js',
  'https://cdn.shopify.com/oxygen-v2/53091/115564/237336/3308732/assets/WistiaPlayer-DYk3x_Wc.js',
  'https://cdn.shopify.com/oxygen-v2/53091/115564/237336/3308732/assets/WistiaPlayerWrapper-6MYR7JP6-B8-qyW_z.js',
  'https://cdn.shopify.com/oxygen-v2/53091/115564/237336/3308732/assets/wistia-player-OT73HWX2-Yw47uoNM.js',
];
const LOADING_FALLBACK_REVEAL_TIMEOUT_MS = 6500;
const DRACO_DECODER_BASE = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7';
const DRACO_RUNTIME_ASSETS = [
  {
    url: `${DRACO_DECODER_BASE}/draco_decoder.js`,
    localPath: '/draco/1.5.7/draco_decoder.js',
  },
  {
    url: `${DRACO_DECODER_BASE}/draco_decoder.wasm`,
    localPath: '/draco/1.5.7/draco_decoder.wasm',
  },
  {
    url: `${DRACO_DECODER_BASE}/draco_wasm_wrapper.js`,
    localPath: '/draco/1.5.7/draco_wasm_wrapper.js',
  },
];
const MIRROR_HOSTS = new Set([
  'cdn.shopify.com',
  'pds-shop-design.myshopify.com',
]);

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function inferLocalPath(urlString) {
  const url = new URL(urlString);
  const host = url.hostname === 'shopify.design' ? '' : url.hostname;
  const pathname = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  const ext = path.extname(pathname);
  const safeQuery = url.search
    ? `__${crypto.createHash('sha1').update(url.search).digest('hex').slice(0, 10)}`
    : '';
  const queryHint = url.search
    ? url.search.replace(/^[?]/, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 40)
    : '';
  const querySuffix = url.search ? `${safeQuery}${queryHint ? `__${queryHint}` : ''}` : '';
  const base = host ? path.join(host, pathname) : pathname;

  if (!ext && pathname.endsWith('/')) return path.join(base, 'index');
  if (!ext && pathname && !pathname.endsWith('/')) return `${base}${querySuffix}`;
  return `${base}${querySuffix}`;
}

function variantsForToken(token) {
  const htmlEscaped = token.replaceAll('&', '&amp;');
  const unicodeEscaped = token.replaceAll('&', '\\u0026');
  const slashEscaped = token.replaceAll('/', '\\/');
  const htmlAndSlashEscaped = htmlEscaped.replaceAll('/', '\\/');
  const unicodeAndSlashEscaped = unicodeEscaped.replaceAll('/', '\\/');
  return [
    token,
    htmlEscaped,
    unicodeEscaped,
    slashEscaped,
    htmlAndSlashEscaped,
    unicodeAndSlashEscaped,
  ];
}

function normalizeMirrorUrl(rawValue) {
  let value = decodeHtmlEntities(String(rawValue).trim())
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/\\+$/g, '')
    .replace(/[),]+$/g, '');

  const localMirrorMatch = value.match(/^\/(cdn\.shopify\.com|pds-shop-design\.myshopify\.com)\/(.+)$/);
  if (localMirrorMatch) {
    value = `https://${localMirrorMatch[1]}/${localMirrorMatch[2]}`;
  }

  if (!/^https?:\/\//i.test(value)) return null;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (!MIRROR_HOSTS.has(parsed.hostname)) return null;
  return parsed.toString();
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function fetchToPublic(urlString) {
  const destination = path.join(PUBLIC_DIR, inferLocalPath(urlString));
  if (await exists(destination)) {
    return destination;
  }

  await ensureDir(destination);
  const response = await fetch(urlString, {
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      accept: '*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${urlString}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(destination, buffer);
  return destination;
}

async function fetchToLocalPath(urlString, localPath) {
  const destination = path.join(PUBLIC_DIR, localPath.replace(/^\/+/, ''));
  if (await exists(destination)) {
    return destination;
  }

  await ensureDir(destination);
  const response = await fetch(urlString, {
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      accept: '*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${urlString}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(destination, buffer);
  return destination;
}

async function listTextFiles(dirPath) {
  const files = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listTextFiles(fullPath));
      continue;
    }

    if (/\.(?:html|js|css|json|txt)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function collectMirrorUrls(text) {
  const urls = new Set();
  const pattern = /(?:https?:\/\/(?:cdn\.shopify\.com|pds-shop-design\.myshopify\.com)|\/(?:cdn\.shopify\.com|pds-shop-design\.myshopify\.com))\/[^"'`\s<>()]+/g;

  for (const match of text.matchAll(pattern)) {
    const normalized = normalizeMirrorUrl(match[0]);
    if (normalized) {
      urls.add(normalized);
    }
  }

  return urls;
}

function localPathForUrl(urlString) {
  const localPath = inferLocalPath(urlString).replaceAll(path.sep, '/');
  return `/${localPath}`;
}

function stripAnalyticsFromHtml(text) {
  return text
    .replace(/<script async="" src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=[^"]+"><\/script>/g, '')
    .replace(/<script>window\.dataLayer = window\.dataLayer \|\| \[\];\s*function gtag\(\)\{dataLayer\.push\(arguments\);\}\s*gtag\('js', new Date\(\)\);\s*gtag\('config', 'G-WG68HKXTX6'\);<\/script>/g, '')
    .replace(/<link rel="preconnect" href="https:\/\/cdn\.shopify\.com"\/>/g, '')
    .replace(/<link rel="preconnect" href="\/cdn\.shopify\.com"\/>/g, '');
}

function stripAnalyticsFromRoot(text) {
  return text
    .replace(',{rel:"preconnect",href:"https://cdn.shopify.com"}', '')
    .replace(',{rel:"preconnect",href:"/cdn.shopify.com"}', '')
    .replace(
      /e\.jsx\("script",\{async:!0,src:`https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=\$\{s\}`\}\),e\.jsx\("script",\{dangerouslySetInnerHTML:\{__html:`window\.dataLayer = window\.dataLayer \|\| \[\];\nfunction gtag\(\)\{dataLayer\.push\(arguments\);\}\ngtag\('js', new Date\(\)\);\ngtag\('config', '\$\{s\}'\);`\}\}\)/g,
      'null,null',
    );
}

function replaceBundleSnippet(text, needle, replacement, label) {
  if (text.includes(replacement)) {
    return text;
  }

  if (!text.includes(needle)) {
    throw new Error(`Unable to patch ${label} in homepage bundle.`);
  }

  return text.replace(needle, replacement);
}

function patchHomepageBundle(text) {
  let patched = text;
  const loadingReadyOriginal =
    'const _=Se.useCallback(()=>{p(!1),document.querySelector(".layout-root")?.classList.remove("loading"),window.dispatchEvent(new Event(aa))},[]);';
  const loadingReadyDelayed =
    `const __codexIntroStart=Se.useRef(typeof performance<"u"?performance.now():Date.now()),_=Se.useCallback(()=>{const T=typeof performance<"u"?performance.now():Date.now(),E=Math.max(0,${INTRO_READY_MIN_DURATION_MS}-(T-__codexIntroStart.current)),S=()=>{p(!1),document.querySelector(".layout-root")?.classList.remove("loading"),window.dispatchEvent(new Event(aa))};E>0?window.setTimeout(S,E):S()},[]);`;
  const loadingReadyDelayedPattern =
    /const __codexIntroStart=Se\.useRef\(typeof performance<"u"\?performance\.now\(\):Date\.now\(\)\),_=Se\.useCallback\(\(\)=>\{const T=typeof performance<"u"\?performance\.now\(\):Date\.now\(\),E=Math\.max\(0,\d+-\(T-__codexIntroStart\.current\)\),S=\(\)=>\{p\(!1\),document\.querySelector\("\.layout-root"\)\?\.classList\.remove\("loading"\),window\.dispatchEvent\(new Event\(aa\)\)\};E>0\?window\.setTimeout\(S,E\):S\(\)\},\[\]\);/;
  const loadingFallbackPatched =
    `${loadingReadyDelayed}Se.useEffect(()=>{if(!c||!d)return;const T=window.setTimeout(()=>{const E=document.querySelector(".layout-root"),S=Array.from(document.querySelectorAll("div")).find(M=>{const L=getComputedStyle(M);return L.position==="fixed"&&L.zIndex==="99999"});if(!E?.classList.contains("loading")||!S)return;E.classList.add("loading-fallback"),E.classList.remove("loading"),p(!1),S.remove(),window.dispatchEvent(new Event(aa))},${LOADING_FALLBACK_REVEAL_TIMEOUT_MS});return()=>window.clearTimeout(T)},[c,d]);`;
  const legacyLoadingFallbackPatched =
    'const _=Se.useCallback(()=>{p(!1),document.querySelector(".layout-root")?.classList.remove("loading"),window.dispatchEvent(new Event(aa))},[]);Se.useEffect(()=>{if(!c||!d)return;const T=window.setTimeout(()=>{const E=document.querySelector(".layout-root");E?.classList.add("loading-fallback"),E?.classList.remove("loading"),p(!1),window.dispatchEvent(new Event(aa))},600);return()=>window.clearTimeout(T)},[c,d]);';

  patched = replaceBundleSnippet(
    patched,
    'return a==null?null:r.layout.cards[a]?.modal??null',
    'if(a==null)return null;const o=r.layout.cards[a];if(!o?.modal)return null;const l=o.videoSrc??o.modal.src,c=o.imageSrcs?.[0]??o.modal.poster;return{...o.modal,src:l??void 0,poster:c??void 0}',
    'webgl carousel modal lookup',
  );

  patched = replaceBundleSnippet(
    patched,
    'function l5({src:n,poster:e,wistiaId:t,title:r}){const i=!!t,',
    'function l5({src:n,poster:e,wistiaId:t,title:r}){const i=!!t&&!n,',
    'modal video player wistia preference',
  );

  patched = replaceBundleSnippet(
    patched,
    'const u=a?Ii(a,hx):void 0,f=Se.useCallback(()=>{o&&OS(o)},[o]);',
    'const u=a?Ii(a,hx):void 0,f=Se.useCallback(()=>{if(!o)return;const h=i??o.src,d=a??o.poster;OS(h||d?{...o,src:h??void 0,poster:d??void 0}:o)},[o,i,a]);',
    'hero modal normalization',
  );

  patched = replaceBundleSnippet(
    patched,
    'return s?$.jsx("button",{type:"button",className:"carousel-card carousel-card--interactive","data-card-index":i,"aria-label":gG(r,i),style:a,onClick:()=>OS(s),children:o},s.slug)',
    'return s?$.jsx("button",{type:"button",className:"carousel-card carousel-card--interactive","data-card-index":i,"aria-label":gG(r,i),style:a,onClick:()=>{const l=r.videoSrc??s.src,c=r.imageSrcs?.[0]??s.poster;OS(l||c?{...s,src:l??void 0,poster:c??void 0}:s)},children:o},s.slug)',
    'carousel modal normalization',
  );

  patched = replaceBundleSnippet(
    patched,
    'const s=Se.useMemo(()=>n.map(T=>T.modal).filter(T=>!!T),[n]),a=Se.useMemo(()=>e.map(T=>T.modal),[e]),o=Se.useMemo(()=>[...s,...a,...t?[t]:[]],[s,a,t]),l=Se.useMemo(()=>new Map(o.map(T=>[T.slug,T])),[o]),',
    'const s=Se.useMemo(()=>n.map(T=>T.modal?{...T.modal,src:T.videoSrc??T.modal.src,poster:T.imageSrcs?.[0]??T.modal.poster}:null).filter(T=>!!T),[n]),a=Se.useMemo(()=>e.map(T=>T.modal?{...T.modal,src:T.videoSrc??T.modal.src,poster:T.posterSrc??T.modal.poster}:null).filter(T=>!!T),[e]),o=Se.useMemo(()=>[...s,...a,...t?[t]:[]],[s,a,t]),l=Se.useMemo(()=>new Map(o.map(T=>[T.slug,T])),[o]),',
    'slug modal normalization',
  );

  if (loadingReadyDelayedPattern.test(patched)) {
    patched = patched.replace(loadingReadyDelayedPattern, loadingReadyDelayed);
  } else {
    patched = replaceBundleSnippet(
      patched,
      loadingReadyOriginal,
      loadingReadyDelayed,
      'intro ready delay',
    );
  }

  if (ENABLE_LOADING_FALLBACK) {
    patched = replaceBundleSnippet(
      patched,
      loadingReadyDelayed,
      loadingFallbackPatched,
      'loading fallback reveal',
    );
  } else {
    patched = patched
      .replace(loadingFallbackPatched, loadingReadyDelayed)
      .replace(legacyLoadingFallbackPatched, loadingReadyDelayed);
  }

  return patched;
}

function patchHomepageStyles(text) {
  const fallbackStyles = `
/* codex-shopify-loading-fallback:start */
.layout-root.loading-fallback .site-header {
  top: 0;
  opacity: 1;
  animation: none !important;
}

.layout-root.loading-fallback .hero {
  transform: translateY(0);
  animation: none !important;
}

.layout-root.loading-fallback .hero-live-bar,
.layout-root.loading-fallback [data-reveal="headline-artifact"],
.layout-root.loading-fallback .carousel-card-shell {
  opacity: 1 !important;
  animation: none !important;
}

.layout-root.loading-fallback .hero-live-bar {
  clip-path: inset(0 0 0 0);
}

.layout-root.loading-fallback .hero-grid-card,
.layout-root.loading-fallback .carousel-card-shell {
  opacity: 1 !important;
  transform: none !important;
  animation: none !important;
  transition: none !important;
}

.layout-root.loading-fallback .wr .wr-text {
  color: inherit !important;
  transform: none !important;
  animation: none !important;
}

.layout-root.loading-fallback .wr .wr-text::before {
  visibility: hidden !important;
  animation: none !important;
}
/* codex-shopify-loading-fallback:end */
`;

  const markedFallbackPattern =
    /\n\/\* codex-shopify-loading-fallback:start \*\/[\s\S]*?\/\* codex-shopify-loading-fallback:end \*\/\n?/;
  const legacyFallbackPattern =
    /\n@media \(prefers-reduced-motion: no-preference\) {\n  \.layout-root\.loading-fallback \.site-header[\s\S]*$/;
  let patched = text;

  if (markedFallbackPattern.test(patched)) {
    patched = patched.replace(markedFallbackPattern, '\n');
  }

  if (legacyFallbackPattern.test(patched)) {
    patched = patched.replace(legacyFallbackPattern, '\n');
  }

  if (!ENABLE_LOADING_FALLBACK) {
    return patched;
  }

  return `${patched}\n${fallbackStyles}\n`;
}

async function rewriteFile(filePath, replacements) {
  let text = await fs.readFile(filePath, 'utf8');
  const original = text;

  for (const [sourceToken, localPath] of replacements) {
    for (const variant of variantsForToken(sourceToken)) {
      text = text.split(variant).join(localPath);
    }
  }

  for (const variant of variantsForToken(`${DRACO_DECODER_BASE}/`)) {
    text = text.split(variant).join('/draco/1.5.7/');
  }

  if (filePath === HTML_FILE) {
    text = stripAnalyticsFromHtml(text);
  }

  if (filePath === path.join(OXYGEN_ASSET_DIR, 'root-CRV0kK55.js')) {
    text = stripAnalyticsFromRoot(text);
  }

  if (filePath === INDEX_BUNDLE_FILE) {
    text = patchHomepageBundle(text);
  }

  if (filePath === INDEX_STYLE_FILE) {
    text = patchHomepageStyles(text);
  }

  if (text !== original) {
    await fs.writeFile(filePath, text);
    return true;
  }

  return false;
}

async function stubClarity() {
  const clarityFile = path.join(OXYGEN_ASSET_DIR, 'clarity-MEz6LakL.js');
  const clarityStub = `const modulePreloadRel = "modulepreload";
const seen = {};
const resolveAssetPath = (asset) =>
  \`/cdn.shopify.com/oxygen-v2/53091/115564/237336/3308732/\${asset}\`;

const _ = (loader, dependencies) => {
  let preload = Promise.resolve();

  if (dependencies && dependencies.length > 0) {
    const nonceMeta = document.querySelector("meta[property=csp-nonce]");
    const nonce = nonceMeta?.nonce || nonceMeta?.getAttribute("nonce");

    preload = Promise.allSettled(
      dependencies.map((dependency) => {
        const href = resolveAssetPath(dependency);

        if (href in seen) {
          return undefined;
        }

        seen[href] = true;

        const isStylesheet = href.endsWith(".css");
        const existingSelector = isStylesheet ? '[rel="stylesheet"]' : "";

        if (document.querySelector(\`link[href="\${href}"]\${existingSelector}\`)) {
          return undefined;
        }

        const link = document.createElement("link");
        link.rel = isStylesheet ? "stylesheet" : modulePreloadRel;

        if (!isStylesheet) {
          link.as = "script";
        }

        link.crossOrigin = "";
        link.href = href;

        if (nonce) {
          link.setAttribute("nonce", nonce);
        }

        document.head.appendChild(link);

        if (!isStylesheet) {
          return undefined;
        }

        return new Promise((resolve, reject) => {
          link.addEventListener("load", resolve);
          link.addEventListener("error", () =>
            reject(new Error(\`Unable to preload CSS for \${href}\`)),
          );
        });
      }),
    );
  }

  const onPreloadError = (error) => {
    const event = new Event("vite:preloadError", { cancelable: true });
    event.payload = error;
    window.dispatchEvent(event);

    if (!event.defaultPrevented) {
      throw error;
    }
  };

  return preload.then((results) => {
    for (const result of results || []) {
      if (result.status === "rejected") {
        onPreloadError(result.reason);
      }
    }

    return loader().catch(onPreloadError);
  });
};

function i() {}
function t() {}

export { _, i, t };
`;
  await fs.writeFile(clarityFile, clarityStub);
}

async function main() {
  await Promise.all(EXTRA_RUNTIME_URLS.map(fetchToPublic));
  await Promise.all(
    DRACO_RUNTIME_ASSETS.map(({ url, localPath }) => fetchToLocalPath(url, localPath)),
  );

  const textFiles = [
    HTML_FILE,
    ...await listTextFiles(path.join(PUBLIC_DIR, 'cdn.shopify.com')),
  ];
  const mirrorUrls = new Set(EXTRA_RUNTIME_URLS);

  for (const filePath of textFiles) {
    const text = await fs.readFile(filePath, 'utf8');
    for (const url of collectMirrorUrls(text)) {
      mirrorUrls.add(url);
    }
  }

  const replacements = new Map();
  for (const url of mirrorUrls) {
    const localPath = localPathForUrl(url);
    const parsed = new URL(url);
    const localMirrorToken = `/${parsed.hostname}${parsed.pathname}${parsed.search}`;

    replacements.set(url, localPath);
    replacements.set(localMirrorToken, localPath);
  }

  let changedFiles = 0;
  for (const filePath of textFiles) {
    if (await rewriteFile(filePath, replacements)) {
      changedFiles += 1;
    }
  }

  await stubClarity();

  process.stdout.write(
    `Localized ${replacements.size} mirrored URLs across ${changedFiles} text files and stubbed Clarity.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
