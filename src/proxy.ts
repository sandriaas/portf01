import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== "/404") {
    return NextResponse.next();
  }

  const rewrittenUrl = request.nextUrl.clone();
  rewrittenUrl.pathname = "/__x29_404";

  return NextResponse.rewrite(rewrittenUrl);
}

export const config = {
  matcher: ["/404"],
};
