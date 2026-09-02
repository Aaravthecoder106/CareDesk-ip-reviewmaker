import { NextRequest, NextResponse } from "next/server";

// Lazy-load Clerk only when a request arrives (never at build/module time).
// There is intentionally no env-based bypass: an accidental
// SKIP_ENV_VALIDATION in a production runtime must NOT disable auth.
let clerkHandler: ((request: NextRequest) => ReturnType<typeof NextResponse.next> | ReturnType<typeof NextResponse.redirect>) | null = null;

function getClerkHandler() {
  if (!clerkHandler) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { clerkMiddleware, createRouteMatcher } = require("@clerk/nextjs/server");
    const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/api/webhooks(.*)"]);
    clerkHandler = clerkMiddleware(async (auth: { protect(): Promise<void> }, request: NextRequest) => {
      if (!isPublicRoute(request)) {
        await auth.protect();
      }
    });
  }
  return clerkHandler;
}

export function middleware(request: NextRequest) {
  const handler = getClerkHandler();
  return handler!(request);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
