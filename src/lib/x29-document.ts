import { buildRouteFromSlug, getX29PageManifest, getX29RouteData, normalizeX29InternalLinks } from "@/lib/x29-site";
import type { X29BodyScriptEntry, X29PageConfig } from "@/types/x29";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function normalizeRoute(route: string) {
  if (!route || route === "/") {
    return "/";
  }

  return `/${route.replace(/^\/+|\/+$/g, "")}`;
}

function resolveAliasRoute(route: string) {
  const normalizedRoute = normalizeRoute(route);

  if (normalizedRoute === "/__x29_404") {
    return "/404";
  }

  return normalizedRoute;
}

function renderMetaTag(name: string, content?: string) {
  if (!content) {
    return "";
  }

  return `<meta ${name}="${escapeAttribute(content)}"/>`;
}

function renderScriptEntry(entry: X29BodyScriptEntry) {
  if (entry.kind === "external" && entry.src) {
    return `<script src="${escapeAttribute(entry.src)}" type="text/javascript"></script>`;
  }

  if (entry.kind === "inline" && entry.code) {
    return `<script type="text/javascript">${entry.code}</script>`;
  }

  return "";
}

function renderBodyScripts(config: X29PageConfig) {
  if (config.bodyScriptEntries && config.bodyScriptEntries.length > 0) {
    return config.bodyScriptEntries.map(renderScriptEntry).join("");
  }

  return [
    ...config.bodyInlineScripts.map(
      (code) => `<script type="text/javascript">${code}</script>`,
    ),
    ...config.bodyScriptHrefs.map(
      (src) =>
        `<script src="${escapeAttribute(src)}" type="text/javascript"></script>`,
    ),
  ].join("");
}

function renderHead(config: X29PageConfig) {
  const htmlAttributes = {
    lang: "en",
    class: "w-mod-js",
    ...config.htmlAttributes,
  };
  const htmlAttributeString = Object.entries(htmlAttributes)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}="${escapeAttribute(value)}"`)
    .join(" ");
  const stylesheetHrefs =
    config.stylesheetHrefs && config.stylesheetHrefs.length > 0
      ? config.stylesheetHrefs
      : config.stylesheetHref
        ? [config.stylesheetHref]
        : [];

  const head = [
    "<meta charset=\"utf-8\"/>",
    `<title>${escapeHtml(config.title)}</title>`,
    renderMetaTag("content", config.description)
      .replace('<meta content="', '<meta name="description" content="'),
    config.title
      ? `<meta property="og:title" content="${escapeAttribute(config.title)}"/>`
      : "",
    config.description
      ? `<meta property="og:description" content="${escapeAttribute(config.description)}"/>`
      : "",
    config.ogImageHref
      ? `<meta property="og:image" content="https://www.x29.ai${escapeAttribute(config.ogImageHref)}"/>`
      : "",
    "<meta content=\"width=device-width, initial-scale=1\" name=\"viewport\"/>",
    "<meta content=\"Webflow\" name=\"generator\"/>",
    "<meta name=\"twitter:card\" content=\"summary_large_image\"/>",
    config.title
      ? `<meta name="twitter:title" content="${escapeAttribute(config.title)}"/>`
      : "",
    config.description
      ? `<meta name="twitter:description" content="${escapeAttribute(config.description)}"/>`
      : "",
    config.twitterImageHref
      ? `<meta name="twitter:image" content="https://www.x29.ai${escapeAttribute(config.twitterImageHref)}"/>`
      : "",
    ...stylesheetHrefs.map(
      (href) =>
        `<link href="${escapeAttribute(href)}" rel="stylesheet" type="text/css"/>`,
    ),
    ...config.inlineScripts.map(
      (script) => `<script type="text/javascript">${script}</script>`,
    ),
    config.iconHref
      ? `<link href="${escapeAttribute(config.iconHref)}" rel="shortcut icon" type="image/x-icon"/>`
      : "",
    config.appleTouchIconHref
      ? `<link href="${escapeAttribute(config.appleTouchIconHref)}" rel="apple-touch-icon"/>`
      : "",
    ...config.inlineStyles.map((style) => `<style>${style}</style>`),
  ]
    .filter(Boolean)
    .join("");

  return {
    htmlOpen: `<html ${htmlAttributeString}>`,
    head,
  };
}

function resolveDocumentRoute(route: string) {
  const normalizedRoute = resolveAliasRoute(route);
  const manifest = getX29PageManifest();
  const brokenRoutes = new Set(
    (manifest.brokenRoutes ?? []).map((entry) => normalizeRoute(entry.route)),
  );

  if (normalizedRoute === "/.wf_auth") {
    const notFoundPage = getX29RouteData("/404");
    return {
      requestedRoute: normalizedRoute,
      status: 404,
      page: notFoundPage,
    };
  }

  if (brokenRoutes.has(normalizedRoute)) {
    return {
      requestedRoute: normalizedRoute,
      status: 404,
      page: getX29RouteData("/404"),
    };
  }

  const page = getX29RouteData(normalizedRoute);

  if (page) {
    return {
      requestedRoute: normalizedRoute,
      status: page.config.status ?? 200,
      page,
    };
  }

  return {
    requestedRoute: normalizedRoute,
    status: 404,
    page: getX29RouteData("/404"),
  };
}

export function getX29HtmlDocument(route: string) {
  const resolved = resolveDocumentRoute(route);

  if (!resolved.page) {
    return null;
  }

  const { config, bodyHtml } = resolved.page;
  const { htmlOpen, head } = renderHead(config);

  return {
    status: resolved.status,
    html: [
      "<!DOCTYPE html>",
      htmlOpen,
      `<head>${head}</head>`,
      `<body>${normalizeX29InternalLinks(bodyHtml)}${renderBodyScripts(config)}</body>`,
      "</html>",
    ].join(""),
  };
}

export function getX29RouteFromParams(slug?: string[]) {
  return resolveAliasRoute(buildRouteFromSlug(slug));
}
