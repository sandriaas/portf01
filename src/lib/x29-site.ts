import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type {
  X29Config,
  X29PageConfig,
  X29PageManifest,
  X29PageManifestEntry,
} from "@/types/x29";

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "src", "content");
const LEGACY_CONFIG_PATH = path.join(CONTENT_DIR, "x29-config.json");
const LEGACY_BODY_PATH = path.join(CONTENT_DIR, "x29-body.html");
const SITE_MANIFEST_PATH = path.join(CONTENT_DIR, "x29", "site.json");
const MANIFEST_PATH = path.join(CONTENT_DIR, "x29-pages", "manifest.json");
type MaybeLegacyPageConfig = X29Config & {
  route?: string;
  bodyInlineScripts?: string[];
  bodyScriptHrefs?: string[];
  stylesheetHrefs?: string[];
};

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function normalizeRoute(route: string) {
  if (route === "" || route === "/") {
    return "/";
  }

  return `/${route.replace(/^\/+|\/+$/g, "")}`;
}

function routeFromSlug(slug?: string[]) {
  if (!slug || slug.length === 0) {
    return "/";
  }

  return normalizeRoute(slug.join("/"));
}

function legacyConfig(): X29PageConfig {
  const config = readJson<MaybeLegacyPageConfig>(LEGACY_CONFIG_PATH);

  return {
    ...config,
    route: normalizeRoute(config.route ?? "/"),
    title: decodeHtmlEntities(config.title),
    description: decodeHtmlEntities(config.description),
    bodyInlineScripts: config.bodyInlineScripts ?? [],
    bodyScriptHrefs: config.bodyScriptHrefs ?? config.scriptHrefs ?? [],
    stylesheetHrefs: config.stylesheetHrefs ?? [config.stylesheetHref],
  };
}

function legacyBody() {
  return readFileSync(LEGACY_BODY_PATH, "utf8");
}

function manifestPathForEntry(entry: X29PageManifestEntry) {
  return {
    configPath: resolveContentPath(entry.configPath),
    bodyPath: resolveContentPath(entry.bodyPath),
  };
}

export function getX29PageManifest(): X29PageManifest {
  if (pathExists(SITE_MANIFEST_PATH)) {
    return readJson<X29PageManifest>(SITE_MANIFEST_PATH);
  }

  if (!pathExists(MANIFEST_PATH)) {
    return {
      defaultRoute: "/",
      pages: [
        {
          route: "/",
          configPath: "x29-config.json",
          bodyPath: "x29-body.html",
        },
      ],
    };
  }

  return readJson<X29PageManifest>(MANIFEST_PATH);
}

function pathExists(filePath: string) {
  return existsSync(filePath);
}

function resolveContentPath(relativeOrProjectPath: string) {
  if (path.isAbsolute(relativeOrProjectPath)) {
    return relativeOrProjectPath;
  }

  if (relativeOrProjectPath.startsWith("src/content/")) {
    return path.join(ROOT, relativeOrProjectPath);
  }

  return path.resolve(CONTENT_DIR, relativeOrProjectPath);
}

function readPageConfigFromEntry(entry: X29PageManifestEntry): X29PageConfig {
  const { configPath } = manifestPathForEntry(entry);
  const rawConfig = readJson<MaybeLegacyPageConfig>(configPath);

  return {
    ...rawConfig,
    route: normalizeRoute(rawConfig.route ?? entry.route),
    title: decodeHtmlEntities(rawConfig.title),
    description: decodeHtmlEntities(rawConfig.description),
    bodyInlineScripts: rawConfig.bodyInlineScripts ?? [],
    bodyScriptHrefs: rawConfig.bodyScriptHrefs ?? rawConfig.scriptHrefs ?? [],
    stylesheetHrefs: rawConfig.stylesheetHrefs ?? [rawConfig.stylesheetHref],
  };
}

function readPageBodyFromEntry(entry: X29PageManifestEntry) {
  const { bodyPath } = manifestPathForEntry(entry);
  return readFileSync(bodyPath, "utf8");
}

function decodeHtmlEntities(value: string) {
  let currentValue = value;

  for (let index = 0; index < 5; index += 1) {
    const nextValue = currentValue
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ");

    if (nextValue === currentValue) {
      return nextValue;
    }

    currentValue = nextValue;
  }

  return currentValue;
}

function findPageEntry(route: string) {
  const manifest = getX29PageManifest();
  return manifest.pages.find((entry) => normalizeRoute(entry.route) === route);
}

export function getX29RouteData(route: string) {
  const normalizedRoute = normalizeRoute(route);
  const entry = findPageEntry(normalizedRoute);

  if (entry) {
    return {
      config: readPageConfigFromEntry(entry),
      bodyHtml: readPageBodyFromEntry(entry),
    };
  }

  if (normalizedRoute === "/") {
    return {
      config: legacyConfig(),
      bodyHtml: legacyBody(),
    };
  }

  return null;
}

export function getX29PagePaths() {
  const manifest = getX29PageManifest();
  return manifest.pages.map((entry) => normalizeRoute(entry.route));
}

export function getX29MetadataForRoute(route: string) {
  const data = getX29RouteData(route);

  if (!data) {
    return null;
  }

  const title = decodeHtmlEntities(data.config.title);
  const description = decodeHtmlEntities(data.config.description);

  return {
    title,
    description,
    icons: {
      icon: data.config.iconHref,
      apple: data.config.appleTouchIconHref,
    },
    openGraph: {
      title,
      description,
      images: data.config.ogImageHref ? [data.config.ogImageHref] : [],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: data.config.twitterImageHref ? [data.config.twitterImageHref] : [],
    },
  };
}

export function normalizeX29InternalLinks(bodyHtml: string) {
  return bodyHtml
    .replace(
      /((?:href|action)=["'])https?:\/\/(?:www\.)?x29\.ai(\/[^"']*)?(["'])/gi,
      (_match, prefix: string, suffix: string | undefined, quote: string) =>
        `${prefix}${suffix ?? "/"}${quote}`,
    );
}

export function buildRouteFromSlug(slug?: string[]) {
  return routeFromSlug(slug);
}
