import type { NextRequest } from "next/server";

import { getX29HtmlDocument, getX29RouteFromParams } from "@/lib/x29-document";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await params;
  const route = getX29RouteFromParams(slug);
  const document = getX29HtmlDocument(route);

  if (!document) {
    return new Response("Not Found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }

  return new Response(document.html, {
    status: document.status,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await params;
  const route = getX29RouteFromParams(slug);

  if (route !== "/.wf_auth") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        allow: "GET, HEAD, OPTIONS",
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }

  const document = getX29HtmlDocument(route);

  if (!document) {
    return new Response("Not Found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }

  return new Response(document.html, {
    status: document.status,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

export async function HEAD(
  _request: NextRequest,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await params;
  const route = getX29RouteFromParams(slug);
  const document = getX29HtmlDocument(route);

  return new Response(null, {
    status: document?.status ?? 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}
