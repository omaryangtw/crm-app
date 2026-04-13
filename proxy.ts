import { auth } from "@/app/_lib/auth";

const PROTECTED_PREFIXES = [
  "/clients",
  "/cases",
  "/contacts",
  "/export",
  "/performance",
  "/files",
];

export const proxy = auth((req) => {
  const isProtected = PROTECTED_PREFIXES.some((p) =>
    req.nextUrl.pathname.startsWith(p)
  );

  if (isProtected && !req.auth) {
    return Response.redirect(new URL("/login", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
