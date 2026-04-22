import { X29_SITE_DATA } from "@/generated/x29-site-data";
import { applyX29HomeHeroOverride } from "@/lib/x29-home-hero";

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

function findPageEntry(route: string) {
  const manifest = getX29PageManifest();
  return manifest.pages.find((entry) => normalizeRoute(entry.route) === route);
}

export function getX29PageManifest() {
  return X29_SITE_DATA.manifest;
}

export function getX29RouteData(route: string) {
  const normalizedRoute = normalizeRoute(route);
  const data = X29_SITE_DATA.routes[normalizedRoute];

  if (!data) {
    return null;
  }

  if (normalizedRoute !== "/") {
    return data;
  }

  return {
    config: data.config,
    bodyHtml: applyX29HomeHeroOverride(normalizedRoute, data.bodyHtml),
  };
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

  const { title, description, iconHref, appleTouchIconHref, ogImageHref, twitterImageHref } =
    data.config;

  return {
    title,
    description,
    icons: {
      icon: iconHref,
      apple: appleTouchIconHref,
    },
    openGraph: {
      title,
      description,
      images: ogImageHref ? [ogImageHref] : [],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: twitterImageHref ? [twitterImageHref] : [],
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

export function hasX29Route(route: string) {
  return Boolean(findPageEntry(normalizeRoute(route)));
}
