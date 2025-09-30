// Utility to get a cookie value from Express req
import type { Request } from "express";

export function getCookie(req: Request, name: string): string | undefined {
  // Try req.cookies first (if cookie-parser is used)
  if (req.cookies && req.cookies[name]) {
    return req.cookies[name];
  }
  // Fallback: parse from req.headers.cookie
  const rawCookie = req.headers.cookie;
  if (rawCookie) {
    const cookiesArr = rawCookie.split(";");
    for (const cookieStr of cookiesArr) {
      const [key, value] = cookieStr.trim().split("=");
      if (key === name) {
        return value;
      }
    }
  }
  return undefined;
}
