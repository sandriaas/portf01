/**
 * DelveBlue microfrontend router.
 *
 * Owns the custom domain (arvi.qzz.io) and dispatches requests to
 * microfrontend Workers via service bindings:
 *   /            -> MAIN     (@delveblue/main,   worker: delveblue-001)
 *   /our-works   -> GALLERY  (@delveblue/gallery, worker: delvebluegallery)
 *
 * Each microfrontend is a full Next.js (OpenNext) app served at the site root,
 * so for the gallery we strip the /our-works prefix before forwarding and
 * rewrite asset/anchor paths in the HTML/CSS response so they resolve back
 * under /our-works.
 */

interface Env {
  MAIN: Fetcher;
  GALLERY: Fetcher;
}

const GALLERY_PREFIX = "/our-works";

// The gallery is a Shopify mirror that serves assets from many unpredictable
// root paths (/cdn.shopify.com/..., /carousel/..., /_next/..., etc). Rather than
// maintain an allowlist, we prefix EVERY root-relative URL with the mount path,
// except links that should stay as-is (anchors, protocol-relative, data:, etc).
function shouldPrefix(url: string): boolean {
  if (!url) return false;
  if (!url.startsWith("/")) return false; // relative / absolute-scheme
  if (url.startsWith("//")) return false; // protocol-relative
  if (url.startsWith(GALLERY_PREFIX + "/") || url === GALLERY_PREFIX) return false; // already prefixed
  if (url.startsWith("/#")) return false; // in-page anchor
  return true;
}

class AttrRewriter {
  constructor(private attr: string, private prefix: string) {}
  element(el: Element) {
    const v = el.getAttribute(this.attr);
    if (v && shouldPrefix(v)) {
      el.setAttribute(this.attr, this.prefix + v);
    }
  }
}

class SrcsetRewriter {
  constructor(private prefix: string) {}
  element(el: Element) {
    for (const attr of ["srcset", "imagesrcset"]) {
      const v = el.getAttribute(attr);
      if (!v) continue;
      const rewritten = v
        .split(",")
        .map((part) => {
          const seg = part.trim();
          const [u, d] = seg.split(/\s+/, 2);
          if (u && shouldPrefix(u)) return `${this.prefix}${u}${d ? " " + d : ""}`;
          return seg;
        })
        .join(", ");
      el.setAttribute(attr, rewritten);
    }
  }
}

// Rewrites url(...) inside inline <style> element text.
class InlineStyleRewriter {
  constructor(private prefix: string) {}
  text(t: Text) {
    if (!t.text) return;
    const out = t.text.replace(
      /url\(\s*(['"]?)(\/[^'")]+)\1\s*\)/g,
      (m, q, p) => (shouldPrefix(p) ? `url(${q}${this.prefix}${p}${q})` : m),
    );
    if (out !== t.text) t.replace(out, { html: false });
  }
}

function rewriteHtml(res: Response, prefix: string): Response {
  const rw = new HTMLRewriter()
    .on("a", new AttrRewriter("href", prefix))
    .on("link", new AttrRewriter("href", prefix))
    .on("link", new SrcsetRewriter(prefix))
    .on("script", new AttrRewriter("src", prefix))
    .on("img", new AttrRewriter("src", prefix))
    .on("img", new SrcsetRewriter(prefix))
    .on("source", new AttrRewriter("src", prefix))
    .on("source", new SrcsetRewriter(prefix))
    .on("video", new AttrRewriter("poster", prefix))
    .on("video", new AttrRewriter("src", prefix))
    .on("form", new AttrRewriter("action", prefix))
    .on("use", new AttrRewriter("href", prefix))
    .on("style", new InlineStyleRewriter(prefix));
  return rw.transform(res);
}

async function rewriteCss(res: Response, prefix: string): Promise<Response> {
  const css = await res.text();
  const out = css.replace(
    /url\(\s*(['"]?)(\/[^'")]+)\1\s*\)/g,
    (m, q, path) => (shouldPrefix(path) ? `url(${q}${prefix}${path}${q})` : m),
  );
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  return new Response(out, { status: res.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Gallery microfrontend mounted at /our-works
    if (path === GALLERY_PREFIX || path.startsWith(GALLERY_PREFIX + "/")) {
      const innerPath = path.slice(GALLERY_PREFIX.length) || "/";
      const innerUrl = new URL(request.url);
      innerUrl.pathname = innerPath;
      const innerReq = new Request(innerUrl.toString(), request);
      const res = await env.GALLERY.fetch(innerReq);
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/html")) return rewriteHtml(res, GALLERY_PREFIX);
      if (ct.includes("text/css")) return rewriteCss(res, GALLERY_PREFIX);
      return res;
    }

    // Everything else -> main site (served at root, no rewrite needed).
    const mainRes = await env.MAIN.fetch(request);

    // Gallery serves many assets from root paths (/cdn.shopify.com/..., /favicons/...,
    // /clock/..., etc) that its client JS requests at runtime — those can't be
    // prefixed by HTML rewriting. If MAIN 404s an asset-like request, fall back to
    // the gallery worker so its mirrored Shopify CDN assets resolve.
    if (mainRes.status === 404 && isLikelyGalleryAsset(path)) {
      const fallback = await env.GALLERY.fetch(request);
      if (fallback.status !== 404) return fallback;
    }

    return mainRes;
  },
};

// Root paths that belong to the gallery's mirrored asset tree.
const GALLERY_ASSET_PREFIXES = [
  "/cdn.shopify.com/",
  "/pds-shop-design.myshopify.com/",
  "/shopify-design/",
  "/favicons/",
  "/carousel/",
  "/clock/",
  "/draco/",
  "/models/",
  "/fonts/",
  "/icons/",
];

function isLikelyGalleryAsset(path: string): boolean {
  return GALLERY_ASSET_PREFIXES.some((p) => path.startsWith(p));
}
