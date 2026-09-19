export interface RateLimiter {
  /** Counts one attempt for the key; `retryAfterSeconds` says when a refused key may try again */
  hit(key: string): { allowed: boolean; retryAfterSeconds: number }
}

/**
 * Fixed-window limiter held in this process's memory. It slows down a single visitor
 * hammering an open endpoint; with several backend instances each keeps its own count,
 * so a shared store (Redis) is the next step when the backend is scaled out.
 */
export function createRateLimiter(
  limit: number,
  windowMs: number,
  now: () => number = Date.now
): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>()

  return {
    hit(key) {
      const t = now()
      // Drop expired windows so the map does not grow with every visitor ever seen
      if (windows.size > 5000) {
        for (const [k, w] of windows) if (t - w.start >= windowMs) windows.delete(k)
      }

      let w = windows.get(key)
      if (!w || t - w.start >= windowMs) {
        w = { start: t, count: 0 }
        windows.set(key, w)
      }
      w.count += 1

      const allowed = w.count <= limit
      return { allowed, retryAfterSeconds: allowed ? 0 : Math.ceil((w.start + windowMs - t) / 1000) }
    },
  }
}

/** The requesting address. Medusa trusts one proxy hop (`trust proxy` = 1), so behind exactly one reverse proxy this is the visitor, not the proxy */
export function clientKey(req: { ip?: string; socket?: { remoteAddress?: string } }): string {
  return req.ip || req.socket?.remoteAddress || "unknown"
}
