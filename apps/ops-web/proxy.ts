import { clerkMiddleware, createRouteMatcher, type ClerkMiddlewareAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

// Protect all routes in the ops dashboard
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);
const isProtectedRoute = createRouteMatcher(['/(.*)']);

const proxy = clerkMiddleware(async (auth: ClerkMiddlewareAuth, req: NextRequest) => {
    if (isProtectedRoute(req) && !isPublicRoute(req)) {
        await auth.protect();
    }
});

export { proxy };
export default proxy;

export const config = {
    matcher: [
        // Skip Next.js internals and all static files
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
};
