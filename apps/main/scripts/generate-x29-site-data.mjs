#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "src", "content");
const LEGACY_CONFIG_PATH = path.join(CONTENT_DIR, "x29-config.json");
const LEGACY_BODY_PATH = path.join(CONTENT_DIR, "x29-body.html");
const SITE_MANIFEST_PATH = path.join(CONTENT_DIR, "x29", "site.json");
const LEGACY_MANIFEST_PATH = path.join(CONTENT_DIR, "x29-pages", "manifest.json");
const OUTPUT_PATH = path.join(ROOT, "src", "generated", "x29-site-data.ts");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeRoute(route) {
  if (!route || route === "/") {
    return "/";
  }

  return `/${route.replace(/^\/+|\/+$/g, "")}`;
}

function decodeHtmlEntities(value) {
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

function resolveContentPath(relativeOrProjectPath) {
  if (path.isAbsolute(relativeOrProjectPath)) {
    return relativeOrProjectPath;
  }

  if (relativeOrProjectPath.startsWith("src/content/")) {
    return path.join(ROOT, relativeOrProjectPath);
  }

  return path.resolve(CONTENT_DIR, relativeOrProjectPath);
}

function normalizeManifestEntry(entry) {
  return {
    ...entry,
    route: normalizeRoute(entry.route),
  };
}

function normalizeConfig(rawConfig, fallbackRoute) {
  return {
    ...rawConfig,
    route: normalizeRoute(rawConfig.route ?? fallbackRoute),
    title: decodeHtmlEntities(rawConfig.title),
    description: decodeHtmlEntities(rawConfig.description),
    bodyInlineScripts: rawConfig.bodyInlineScripts ?? [],
    bodyScriptHrefs: rawConfig.bodyScriptHrefs ?? rawConfig.scriptHrefs ?? [],
    stylesheetHrefs: (
      rawConfig.stylesheetHrefs ?? [rawConfig.stylesheetHref]
    ).filter(Boolean),
  };
}

function getManifest() {
  if (fs.existsSync(SITE_MANIFEST_PATH)) {
    const manifest = readJson(SITE_MANIFEST_PATH);

    return {
      ...manifest,
      pages: manifest.pages.map(normalizeManifestEntry),
      brokenRoutes: (manifest.brokenRoutes ?? []).map(normalizeManifestEntry),
    };
  }

  if (fs.existsSync(LEGACY_MANIFEST_PATH)) {
    const manifest = readJson(LEGACY_MANIFEST_PATH);

    return {
      ...manifest,
      pages: manifest.pages.map(normalizeManifestEntry),
      brokenRoutes: (manifest.brokenRoutes ?? []).map(normalizeManifestEntry),
    };
  }

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

function buildPayload() {
  const manifest = getManifest();
  const routes = {};

  for (const entry of manifest.pages) {
    const configPath = resolveContentPath(entry.configPath);
    const bodyPath = resolveContentPath(entry.bodyPath);
    const rawConfig = readJson(configPath);

    routes[entry.route] = {
      config: normalizeConfig(rawConfig, entry.route),
      bodyHtml: fs.readFileSync(bodyPath, "utf8"),
    };
  }

  if (!routes["/"] && fs.existsSync(LEGACY_CONFIG_PATH) && fs.existsSync(LEGACY_BODY_PATH)) {
    const rawConfig = readJson(LEGACY_CONFIG_PATH);

    routes["/"] = {
      config: normalizeConfig(rawConfig, "/"),
      bodyHtml: fs.readFileSync(LEGACY_BODY_PATH, "utf8"),
    };
  }

  return {
    manifest,
    routes,
  };
}

function writeOutput(payload) {
  const serialized = JSON.stringify(payload);
  const escaped = serialized
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");

  const fileContents = `import type { X29GeneratedSiteData } from "@/types/x29";

export const X29_SITE_DATA = JSON.parse(
  String.raw\`${escaped}\`,
) as X29GeneratedSiteData;
`;

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, fileContents);
}

const payload = buildPayload();
writeOutput(payload);

console.log(
  `Generated ${path.relative(ROOT, OUTPUT_PATH)} with ${Object.keys(payload.routes).length} routes.`,
);
