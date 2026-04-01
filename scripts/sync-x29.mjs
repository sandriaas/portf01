import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const TARGET_URL = "https://www.x29.ai/";
const TARGET_ORIGIN = new URL(TARGET_URL).origin;
const EXTRA_ROUTE_PATHS = ["/401", "/404"];
const PUBLIC_DIR = path.join(ROOT, "public");
const CONTENT_DIR = path.join(ROOT, "src", "content");
const SITE_CONTENT_DIR = path.join(CONTENT_DIR, "x29");
const PAGE_CONTENT_DIR = path.join(SITE_CONTENT_DIR, "pages");
const RESEARCH_DIR = path.join(ROOT, "docs", "research");

const HEAD_RE = /<head>([\s\S]*?)<\/head>/i;
const BODY_RE = /<body[^>]*>([\s\S]*?)<\/body>/i;
const TITLE_RE = /<title>([\s\S]*?)<\/title>/i;
const HTML_ATTR_RE = /<html\s+([^>]+)>/i;
const DATA_ATTR_RE = /data-(wf-[^=]+)="([^"]+)"/gi;
const STYLE_RE = /<style[^>]*>([\s\S]*?)<\/style>/gi;
const SCRIPT_RE = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
const LINK_RE = /<link\b[^>]*\/?>/gi;
const META_RE = /<meta\b[^>]*\/?>/gi;
const HREF_RE = /<a\b[^>]*href="([^"]+)"/gi;
const URL_RE = /https:\/\/[^\s"'<>]+/g;

function extractAttribute(tag, name) {
  return tag.match(new RegExp(`${name}="([^"]*)"`, "i"))?.[1] ?? null;
}

function decodeEntities(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function sanitizeSegment(segment) {
  const sanitized = segment
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || "file";
}

function normalizePathname(pathname) {
  if (!pathname || pathname === "/") {
    return "/";
  }

  const normalized = pathname.replace(/\/+/g, "/").replace(/\/$/, "");
  return normalized || "/";
}

function normalizeInternalRoute(pathname, search = "") {
  const normalizedPath = normalizePathname(pathname);
  return search ? `${normalizedPath}${search}` : normalizedPath;
}

function normalizeSiteUrl(rawUrl) {
  const url = new URL(rawUrl, TARGET_ORIGIN);

  if (url.origin !== TARGET_ORIGIN) {
    throw new Error(`Cannot normalize off-origin URL: ${rawUrl}`);
  }

  url.hash = "";
  return new URL(
    normalizeInternalRoute(url.pathname, url.search),
    TARGET_ORIGIN,
  ).toString();
}

function routeFromUrl(rawUrl) {
  const url = new URL(rawUrl, TARGET_ORIGIN);
  return normalizeInternalRoute(url.pathname, url.search);
}

function pageKeyFromRoute(route) {
  const pathname = route.split("?")[0] ?? route;

  if (pathname === "/") {
    return "home";
  }

  return pathname
    .split("/")
    .filter(Boolean)
    .map(sanitizeSegment)
    .join("__");
}

function collectAbsoluteUrls(text) {
  const matches = text.match(URL_RE) ?? [];
  const urls = new Set();

  for (const match of matches) {
    for (const part of decodeEntities(match).split(",")) {
      const cleaned = part.replace(/[")';]+$/g, "").trim();

      if (cleaned.startsWith("https://")) {
        urls.add(cleaned);
      }
    }
  }

  return urls;
}

function localPublicPath(rawUrl) {
  const url = new URL(rawUrl);
  const segments = decodeURIComponent(url.pathname)
    .split("/")
    .filter(Boolean)
    .map(sanitizeSegment);

  if (segments.length === 0) {
    segments.push("index.html");
  }

  return path.posix.join("/x29", url.hostname, ...segments);
}

function localFilePath(rawUrl) {
  const url = new URL(rawUrl);
  const segments = decodeURIComponent(url.pathname)
    .split("/")
    .filter(Boolean)
    .map(sanitizeSegment);

  if (segments.length === 0) {
    segments.push("index.html");
  }

  return path.join(PUBLIC_DIR, "x29", url.hostname, ...segments);
}

function isTextAsset(url, contentType) {
  if (contentType) {
    return /(text|javascript|json|xml|svg)/i.test(contentType);
  }

  return /\.(css|js|json|svg|html?)$/i.test(new URL(url).pathname);
}

function shouldDownload(url) {
  const pathname = new URL(url).pathname;

  return /\.(css|js|png|jpe?g|webp|gif|svg|woff2?|ttf|otf|eot|mp4|webm|ico|json)$/i.test(
    pathname,
  );
}

async function ensureParentDir(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function fetchAsset(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (isTextAsset(url, contentType)) {
    return {
      kind: "text",
      contentType,
      body: await response.text(),
    };
  }

  return {
    kind: "binary",
    contentType,
    body: Buffer.from(await response.arrayBuffer()),
  };
}

function replaceUrls(text, urlMap) {
  let output = text;
  const entries = [...urlMap.entries()].sort((left, right) => {
    return right[0].length - left[0].length;
  });

  for (const [remoteUrl, localUrl] of entries) {
    output = output.split(remoteUrl).join(localUrl);
  }

  return output;
}

function localizeText(text, internalUrlMap, assetUrlMap) {
  return replaceUrls(replaceUrls(text, internalUrlMap), assetUrlMap);
}

function extractHeadInfo(headHtml, pageUrl) {
  const title = headHtml.match(TITLE_RE)?.[1]?.trim() ?? "";
  const inlineStyles = [...headHtml.matchAll(STYLE_RE)].map((match) => match[1].trim());
  const inlineScripts = [];

  for (const match of headHtml.matchAll(SCRIPT_RE)) {
    const attrs = match[1] ?? "";
    const body = match[2]?.trim() ?? "";

    if (!/src=/.test(attrs) && body) {
      inlineScripts.push(body);
    }
  }

  const meta = {
    name: {},
    property: {},
  };

  for (const tag of headHtml.match(META_RE) ?? []) {
    const name = extractAttribute(tag, "name");
    const property = extractAttribute(tag, "property");
    const content = extractAttribute(tag, "content") ?? "";

    if (name) {
      meta.name[name] = content;
    }

    if (property) {
      meta.property[property] = content;
    }
  }

  const links = [];
  for (const tag of headHtml.match(LINK_RE) ?? []) {
    const rel = extractAttribute(tag, "rel");
    const href = extractAttribute(tag, "href");

    if (rel && href) {
      links.push({
        rel,
        href: new URL(href, pageUrl).toString(),
      });
    }
  }

  return {
    title,
    inlineStyles,
    inlineScripts,
    meta,
    links,
  };
}

function extractHtmlAttributes(html) {
  const attrs = html.match(HTML_ATTR_RE)?.[1] ?? "";
  const result = {};

  for (const [, key, value] of attrs.matchAll(DATA_ATTR_RE)) {
    result[`data-${key}`] = value;
  }

  return result;
}

function extractBodyScriptEntries(bodyHtml, pageUrl) {
  const scripts = [];

  for (const match of bodyHtml.matchAll(SCRIPT_RE)) {
    const attrs = match[1] ?? "";
    const src = attrs.match(/src="([^"]+)"/i)?.[1] ?? null;
    const body = match[2]?.trim() ?? "";

    if (src) {
      scripts.push({
        kind: "external",
        src: new URL(src, pageUrl).toString(),
      });
      continue;
    }

    if (body) {
      scripts.push({
        kind: "inline",
        code: body,
      });
    }
  }

  return scripts;
}

function stripScripts(html) {
  return html.replace(SCRIPT_RE, "").trim();
}

function extractInternalLinks(html, pageUrl) {
  const links = new Set();

  for (const match of html.matchAll(HREF_RE)) {
    const href = match[1]?.trim();

    if (!href) {
      continue;
    }

    try {
      const nextUrl = new URL(href, pageUrl);

      if (nextUrl.origin !== TARGET_ORIGIN) {
        continue;
      }

      nextUrl.hash = "";
      links.add(normalizeSiteUrl(nextUrl.toString()));
    } catch {}
  }

  return links;
}

function runWithConcurrency(items, limit, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length > 0) {
      const current = queue.shift();

      if (current) {
        await worker(current);
      }
    }
  });

  return Promise.all(runners);
}

async function crawlRoutes(seedRoutes) {
  const queue = seedRoutes.map((route) => normalizeSiteUrl(route));
  const visited = new Set();
  const snapshots = new Map();

  while (queue.length > 0) {
    const currentUrl = queue.shift();

    if (!currentUrl || visited.has(currentUrl)) {
      continue;
    }

    visited.add(currentUrl);
    const response = await fetch(currentUrl, { redirect: "follow" });
    const html = await response.text();
    const normalizedUrl = normalizeSiteUrl(response.url);

    snapshots.set(normalizedUrl, {
      url: normalizedUrl,
      status: response.status,
      html,
    });

    for (const discoveredUrl of extractInternalLinks(html, normalizedUrl)) {
      if (!visited.has(discoveredUrl) && !queue.includes(discoveredUrl)) {
        queue.push(discoveredUrl);
      }
    }
  }

  return snapshots;
}

async function main() {
  await mkdir(CONTENT_DIR, { recursive: true });
  await mkdir(RESEARCH_DIR, { recursive: true });
  await rm(SITE_CONTENT_DIR, { recursive: true, force: true });
  await mkdir(PAGE_CONTENT_DIR, { recursive: true });

  const routeSnapshots = await crawlRoutes(["/", ...EXTRA_ROUTE_PATHS]);
  const internalUrlMap = new Map();

  for (const snapshotUrl of routeSnapshots.keys()) {
    const route = routeFromUrl(snapshotUrl);

    internalUrlMap.set(snapshotUrl, route);

    if (route === "/") {
      internalUrlMap.set(TARGET_ORIGIN, "/");
      internalUrlMap.set(`${TARGET_ORIGIN}/`, "/");
      continue;
    }

    internalUrlMap.set(`${TARGET_ORIGIN}${route}`, route);
    internalUrlMap.set(`${TARGET_ORIGIN}${route}/`, route);
  }

  const discoveredAssetUrls = new Set();
  const textAssets = new Map();
  const pageSnapshots = [];

  for (const snapshot of routeSnapshots.values()) {
    const headHtml = snapshot.html.match(HEAD_RE)?.[1];
    const bodyHtml = snapshot.html.match(BODY_RE)?.[1];

    if (!headHtml || !bodyHtml) {
      throw new Error(`Could not extract head/body for ${snapshot.url}`);
    }

    const route = routeFromUrl(snapshot.url);
    const headInfo = extractHeadInfo(headHtml, snapshot.url);
    const bodyScripts = extractBodyScriptEntries(bodyHtml, snapshot.url);
    const stylesheetHrefs = headInfo.links
      .filter((link) => link.rel.toLowerCase().includes("stylesheet"))
      .map((link) => link.href);

    pageSnapshots.push({
      route,
      key: pageKeyFromRoute(route),
      sourceUrl: snapshot.url,
      status: snapshot.status,
      htmlAttributes: extractHtmlAttributes(snapshot.html),
      headInfo,
      bodyHtml,
      bodyScripts,
      stylesheetHrefs,
    });

    for (const discoveredUrl of collectAbsoluteUrls(snapshot.html)) {
      discoveredAssetUrls.add(discoveredUrl);
    }

    for (const stylesheetHref of stylesheetHrefs) {
      discoveredAssetUrls.add(stylesheetHref);
    }

    for (const script of bodyScripts) {
      if (script.kind === "external") {
        discoveredAssetUrls.add(script.src);
      }
    }
  }

  const pendingTextUrls = [
    ...new Set(
      pageSnapshots.flatMap((pageSnapshot) => [
        ...pageSnapshot.stylesheetHrefs,
        ...pageSnapshot.bodyScripts
          .filter((script) => script.kind === "external")
          .map((script) => script.src),
      ]),
    ),
  ];
  const processedTextUrls = new Set();

  while (pendingTextUrls.length > 0) {
    const currentUrl = pendingTextUrls.shift();

    if (
      !currentUrl ||
      processedTextUrls.has(currentUrl) ||
      !shouldDownload(currentUrl)
    ) {
      continue;
    }

    processedTextUrls.add(currentUrl);
    const asset = await fetchAsset(currentUrl);

    if (asset.kind !== "text") {
      continue;
    }

    textAssets.set(currentUrl, asset);

    for (const nestedUrl of collectAbsoluteUrls(asset.body)) {
      if (!shouldDownload(nestedUrl)) {
        continue;
      }

      discoveredAssetUrls.add(nestedUrl);

      if (isTextAsset(nestedUrl) && !processedTextUrls.has(nestedUrl)) {
        pendingTextUrls.push(nestedUrl);
      }
    }
  }

  const assetUrls = [...discoveredAssetUrls].filter(shouldDownload).sort();
  const assetUrlMap = new Map(assetUrls.map((url) => [url, localPublicPath(url)]));

  await runWithConcurrency(assetUrls, 6, async (url) => {
    const cached = textAssets.get(url);
    const asset = cached ?? (await fetchAsset(url));
    const outputPath = localFilePath(url);

    await ensureParentDir(outputPath);

    if (asset.kind === "text") {
      const localizedBody = localizeText(
        asset.body,
        internalUrlMap,
        assetUrlMap,
      );
      await writeFile(outputPath, localizedBody);
      return;
    }

    await writeFile(outputPath, asset.body);
  });

  const renderablePages = pageSnapshots
    .filter((pageSnapshot) => pageSnapshot.status < 400)
    .sort((left, right) => left.route.localeCompare(right.route));
  const brokenRoutes = pageSnapshots
    .filter((pageSnapshot) => pageSnapshot.status >= 400)
    .map((pageSnapshot) => ({
      route: pageSnapshot.route,
      status: pageSnapshot.status,
      sourceUrl: pageSnapshot.sourceUrl,
    }))
    .sort((left, right) => left.route.localeCompare(right.route));

  const pageManifestEntries = [];
  let compatHomeBodyHtml = null;
  let compatHomeConfig = null;

  for (const pageSnapshot of renderablePages) {
    const localizedBodyHtml = localizeText(
      stripScripts(pageSnapshot.bodyHtml),
      internalUrlMap,
      assetUrlMap,
    );
    const pageConfig = {
      route: pageSnapshot.route,
      key: pageSnapshot.key,
      sourceUrl: pageSnapshot.sourceUrl,
      status: pageSnapshot.status,
      title: pageSnapshot.headInfo.title,
      description: pageSnapshot.headInfo.meta.name.description ?? "",
      htmlAttributes: pageSnapshot.htmlAttributes,
      inlineStyles: pageSnapshot.headInfo.inlineStyles.map((style) =>
        localizeText(style, internalUrlMap, assetUrlMap),
      ),
      inlineScripts: pageSnapshot.headInfo.inlineScripts.map((script) =>
        localizeText(script, internalUrlMap, assetUrlMap),
      ),
      stylesheetHrefs: pageSnapshot.stylesheetHrefs
        .map((url) => assetUrlMap.get(url) ?? url)
        .filter(Boolean),
      iconHref:
        assetUrlMap.get(
          pageSnapshot.headInfo.links.find((link) => link.rel === "shortcut icon")
            ?.href ?? "",
        ) ?? "",
      appleTouchIconHref:
        assetUrlMap.get(
          pageSnapshot.headInfo.links.find((link) => link.rel === "apple-touch-icon")
            ?.href ?? "",
        ) ?? "",
      ogImageHref:
        assetUrlMap.get(pageSnapshot.headInfo.meta.property["og:image"] ?? "") ?? "",
      twitterImageHref:
        assetUrlMap.get(pageSnapshot.headInfo.meta.property["twitter:image"] ?? "") ??
        "",
      bodyScriptEntries: pageSnapshot.bodyScripts.map((script) => {
        if (script.kind === "external") {
          return {
            kind: "external",
            src: assetUrlMap.get(script.src) ?? script.src,
          };
        }

        return {
          kind: "inline",
          code: localizeText(script.code, internalUrlMap, assetUrlMap),
        };
      }),
      scriptHrefs: pageSnapshot.bodyScripts
        .filter((script) => script.kind === "external")
        .map((script) => assetUrlMap.get(script.src) ?? script.src),
      bodyInlineScripts: pageSnapshot.bodyScripts
        .filter((script) => script.kind === "inline")
        .map((script) => localizeText(script.code, internalUrlMap, assetUrlMap)),
    };

    const bodyFileName = `${pageSnapshot.key}.body.html`;
    const configFileName = `${pageSnapshot.key}.config.json`;

    await writeFile(path.join(PAGE_CONTENT_DIR, bodyFileName), localizedBodyHtml);
    await writeFile(
      path.join(PAGE_CONTENT_DIR, configFileName),
      JSON.stringify(pageConfig, null, 2) + "\n",
    );

    if (pageSnapshot.route === "/") {
      compatHomeBodyHtml = localizedBodyHtml;
      compatHomeConfig = pageConfig;
    }

    pageManifestEntries.push({
      route: pageSnapshot.route,
      key: pageSnapshot.key,
      status: pageSnapshot.status,
      title: pageConfig.title,
      bodyPath: path.posix.join("src", "content", "x29", "pages", bodyFileName),
      configPath: path.posix.join("src", "content", "x29", "pages", configFileName),
    });
  }

  const homeEntry = renderablePages.find((pageSnapshot) => pageSnapshot.route === "/");

  if (!homeEntry) {
    throw new Error("Home page was not captured.");
  }

  const siteManifest = {
    targetUrl: TARGET_URL,
    targetOrigin: TARGET_ORIGIN,
    htmlAttributes: {
      "data-wf-domain":
        homeEntry.htmlAttributes["data-wf-domain"] ?? "www.x29.ai",
      "data-wf-site": homeEntry.htmlAttributes["data-wf-site"] ?? "",
    },
    rootRoute: "/",
    notFoundRoute: "/404",
    protectedRoute: "/401",
    pageCount: pageManifestEntries.length,
    brokenRouteCount: brokenRoutes.length,
    pages: pageManifestEntries,
    brokenRoutes,
  };

  await writeFile(
    path.join(SITE_CONTENT_DIR, "site.json"),
    JSON.stringify(siteManifest, null, 2) + "\n",
  );

  if (compatHomeConfig && compatHomeBodyHtml) {
    await writeFile(path.join(CONTENT_DIR, "x29-body.html"), compatHomeBodyHtml);
    await writeFile(
      path.join(CONTENT_DIR, "x29-config.json"),
      JSON.stringify(
        {
          title: compatHomeConfig.title,
          description: compatHomeConfig.description,
          htmlAttributes: compatHomeConfig.htmlAttributes,
          inlineStyles: compatHomeConfig.inlineStyles,
          inlineScripts: compatHomeConfig.inlineScripts,
          stylesheetHref: compatHomeConfig.stylesheetHrefs[0] ?? "",
          iconHref: compatHomeConfig.iconHref,
          appleTouchIconHref: compatHomeConfig.appleTouchIconHref,
          ogImageHref: compatHomeConfig.ogImageHref,
          twitterImageHref: compatHomeConfig.twitterImageHref,
          scriptHrefs: compatHomeConfig.scriptHrefs,
        },
        null,
        2,
      ) + "\n",
    );
  }

  await writeFile(
    path.join(RESEARCH_DIR, "x29-source-home.html"),
    routeSnapshots.get(normalizeSiteUrl("/"))?.html ?? "",
  );
  await writeFile(
    path.join(RESEARCH_DIR, "x29-route-manifest.json"),
    JSON.stringify(
      {
        targetUrl: TARGET_URL,
        crawledRouteCount: routeSnapshots.size,
        pages: pageSnapshots
          .map((pageSnapshot) => ({
            route: pageSnapshot.route,
            status: pageSnapshot.status,
            title: pageSnapshot.headInfo.title,
            sourceUrl: pageSnapshot.sourceUrl,
          }))
          .sort((left, right) => left.route.localeCompare(right.route)),
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    path.join(RESEARCH_DIR, "x29-asset-manifest.json"),
    JSON.stringify(
      {
        targetUrl: TARGET_URL,
        assetCount: assetUrls.length,
        assets: assetUrls.map((url) => ({
          remoteUrl: url,
          localPath: assetUrlMap.get(url),
        })),
      },
      null,
      2,
    ) + "\n",
  );

  console.log(
    JSON.stringify(
      {
        targetUrl: TARGET_URL,
        pageCount: pageManifestEntries.length,
        brokenRouteCount: brokenRoutes.length,
        assetCount: assetUrls.length,
        siteManifestPath: "src/content/x29/site.json",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
