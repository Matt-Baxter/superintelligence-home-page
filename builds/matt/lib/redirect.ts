import { NextResponse } from "next/server";

// 303 redirect after a form post, so the browser follows with a GET. (contract: Form endpoints)
export function redirectTo(request: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

// Only paths on this site are allowed as a return address (no "//other-site" or full URLs).
export function safeReturnPath(value: FormDataEntryValue | null): string {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/";
}
