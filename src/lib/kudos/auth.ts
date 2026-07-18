import type { Redis } from "@upstash/redis";
import { getRedis } from "@/lib/redis";
import { profileForToken } from "@/lib/folkloreJob/floatFunding";

// Bearer authentication for the kudos routes. The float's only identity is
// the opaque token issued at profile creation — set as the kudos_token
// cookie on the funding device, pasted as a recovery string anywhere else.
// The routes accept both: an Authorization bearer header (the pasted
// string) wins over the cookie, so a visitor signing in on a second device
// is never shadowed by a stale cookie.

export type BearerAuth =
  | { kind: "authenticated"; profile: string; token: string }
  | { kind: "no-token" }
  | { kind: "unknown-token" }
  | { kind: "unavailable" };

/** The bearer token a request carries: the Authorization header first, the
 * kudos_token cookie second, null when neither yields one. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header !== null) {
    const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
    return match ? match[1] : null;
  }
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === "kudos_token") {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

/** Resolve a request's bearer token to its profile. Errors as values: the
 * routes map each arm to a status, never a throw. */
export async function authenticateBearer(
  req: Request,
  redis: Redis | null = getRedis(),
): Promise<BearerAuth> {
  const token = bearerToken(req);
  if (token === null || token === "") return { kind: "no-token" };
  if (!redis) return { kind: "unavailable" };
  const profile = await profileForToken(token, redis);
  if (profile === null) return { kind: "unknown-token" };
  return { kind: "authenticated", profile, token };
}
