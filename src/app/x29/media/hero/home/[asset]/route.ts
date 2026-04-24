import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { NextRequest } from "next/server";

import { X29_HOME_HERO_BUCKET_OBJECTS } from "@/lib/x29-home-hero";

const HERO_ASSET_MAP = {
  "landscape.mp4": X29_HOME_HERO_BUCKET_OBJECTS.landscape,
  "portrait.mp4": X29_HOME_HERO_BUCKET_OBJECTS.portrait,
} as const;

const VIDEO_CACHE_CONTROL = "public, max-age=31536000, immutable";

type HeroAssetName = keyof typeof HERO_ASSET_MAP;
type ByteRange = {
  offset: number;
  length: number;
};

function getHeroAsset(name: string) {
  if (!(name in HERO_ASSET_MAP)) {
    return null;
  }

  return HERO_ASSET_MAP[name as HeroAssetName];
}

function parseRangeHeader(
  headerValue: string | null,
  size: number,
): ByteRange | "unsatisfiable" | null {
  if (!headerValue) {
    return null;
  }

  const match = headerValue.match(/^bytes=(.+)$/i);

  if (!match) {
    return "unsatisfiable";
  }

  const ranges = match[1]
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (ranges.length !== 1) {
    return "unsatisfiable";
  }

  const [startPart, endPart] = ranges[0].split("-");

  if (!startPart && !endPart) {
    return "unsatisfiable";
  }

  if (!startPart) {
    const suffixLength = Number.parseInt(endPart ?? "", 10);

    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return "unsatisfiable";
    }

    const length = Math.min(suffixLength, size);

    return {
      offset: size - length,
      length,
    };
  }

  const start = Number.parseInt(startPart, 10);

  if (!Number.isFinite(start) || start < 0 || start >= size) {
    return "unsatisfiable";
  }

  const requestedEnd =
    endPart && endPart.length > 0 ? Number.parseInt(endPart, 10) : size - 1;

  if (!Number.isFinite(requestedEnd) || requestedEnd < start) {
    return "unsatisfiable";
  }

  const end = Math.min(requestedEnd, size - 1);

  return {
    offset: start,
    length: end - start + 1,
  };
}

function applyBaseVideoHeaders(headers: Headers) {
  headers.set("accept-ranges", "bytes");
  headers.set("content-type", headers.get("content-type") ?? "video/mp4");
  headers.set(
    "cache-control",
    headers.get("cache-control") ?? VIDEO_CACHE_CONTROL,
  );
}

function applyObjectHeaders(headers: Headers, object: R2Object) {
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("last-modified", object.uploaded.toUTCString());
  applyBaseVideoHeaders(headers);
}

function buildPartialHeaders(headers: Headers, size: number, range: ByteRange) {
  headers.set(
    "content-range",
    `bytes ${range.offset}-${range.offset + range.length - 1}/${size}`,
  );
  headers.set("content-length", String(range.length));
  return headers;
}

function buildFullHeaders(headers: Headers, size: number) {
  headers.set("content-length", String(size));
  return headers;
}

function rangeNotSatisfiable(size: number) {
  return new Response(null, {
    status: 416,
    headers: {
      "content-range": `bytes */${size}`,
      "accept-ranges": "bytes",
      "content-type": "video/mp4",
      "cache-control": VIDEO_CACHE_CONTROL,
    },
  });
}

async function proxyFallback(request: NextRequest, fallbackUrl: string) {
  const upstreamUrl = new URL(fallbackUrl);
  const version = request.nextUrl.searchParams.get("v");

  if (version) {
    upstreamUrl.searchParams.set("v", version);
  }

  const headers = new Headers();
  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    headers.set("range", rangeHeader);
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers,
  });
  const responseHeaders = new Headers(upstreamResponse.headers);

  applyBaseVideoHeaders(responseHeaders);

  return new Response(request.method === "HEAD" ? null : upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}

async function serveHeroVideo(request: NextRequest, assetName: string) {
  const asset = getHeroAsset(assetName);

  if (!asset) {
    return new Response("Not Found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }

  const { env } = await getCloudflareContext({ async: true });
  const bucket = env.MEDIA_BUCKET;

  if (!bucket) {
    return proxyFallback(request, asset.fallbackUrl);
  }

  const objectHead = await bucket.head(asset.key);

  if (!objectHead) {
    return proxyFallback(request, asset.fallbackUrl);
  }

  const range = parseRangeHeader(request.headers.get("range"), objectHead.size);

  if (range === "unsatisfiable") {
    return rangeNotSatisfiable(objectHead.size);
  }

  const responseHeaders = new Headers();

  applyObjectHeaders(responseHeaders, objectHead);

  if (request.method === "HEAD") {
    return new Response(null, {
      status: range ? 206 : 200,
      headers: range
        ? buildPartialHeaders(responseHeaders, objectHead.size, range)
        : buildFullHeaders(responseHeaders, objectHead.size),
    });
  }

  const objectBody = range
    ? await bucket.get(asset.key, {
        range: {
          offset: range.offset,
          length: range.length,
        },
      })
    : await bucket.get(asset.key);

  if (!objectBody) {
    return proxyFallback(request, asset.fallbackUrl);
  }

  applyObjectHeaders(responseHeaders, objectBody);

  return new Response(objectBody.body, {
    status: range ? 206 : 200,
    headers: range
      ? buildPartialHeaders(responseHeaders, objectHead.size, range)
      : buildFullHeaders(responseHeaders, objectHead.size),
  });
}

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ asset: string }> },
) {
  const { asset } = await params;
  return serveHeroVideo(request, asset);
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ asset: string }> },
) {
  const { asset } = await params;
  return serveHeroVideo(request, asset);
}
