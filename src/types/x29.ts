export interface X29Config {
  title: string;
  description: string;
  htmlAttributes: Record<string, string>;
  inlineStyles: string[];
  inlineScripts: string[];
  stylesheetHref: string;
  iconHref: string;
  appleTouchIconHref: string;
  ogImageHref: string;
  twitterImageHref: string;
  scriptHrefs: string[];
  stylesheetHrefs?: string[];
}

export interface X29BodyScriptEntry {
  kind: "external" | "inline";
  src?: string;
  code?: string;
}

export interface X29PageConfig extends X29Config {
  route: string;
  bodyInlineScripts: string[];
  bodyScriptHrefs: string[];
  bodyScriptEntries?: X29BodyScriptEntry[];
  key?: string;
  sourceUrl?: string;
  status?: number;
}

export interface X29PageManifestEntry {
  route: string;
  configPath: string;
  bodyPath: string;
  key?: string;
  status?: number;
  title?: string;
}

export interface X29PageManifest {
  pages: X29PageManifestEntry[];
  brokenRoutes?: X29PageManifestEntry[];
  defaultRoute?: string;
  rootRoute?: string;
  notFoundRoute?: string;
  protectedRoute?: string;
}
