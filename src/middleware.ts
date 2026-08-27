import { NextRequest, NextResponse } from "next/server";

const skipAuth = !!process.env.SKIP_ENV_VALIDATION;

// Lazy-load Clerk only when needed
let clerkHandler: ((request: NextRequest) => any) | null = null;

function getClerkHandler() {
  if (!clerkHandler && !skipAuth) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { clerkMiddleware, createRouteMatcher } = require("@clerk/nextjs/server");
    const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/api/webhooks(.*)"]);
    clerkHandler = clerkMiddleware(async (auth: any, request: NextRequest) => {
      if (!isPublicRoute(request)) {
        await auth.protect();
      }
    });
  }
  return clerkHandler;
}

export function middleware(request: NextRequest) {
  if (skipAuth) {
    return NextResponse.next();
  }
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
