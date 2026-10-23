import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Emit a self-contained server bundle instead of expecting `node_modules` to
   * be resolvable from the working directory at runtime. Next traces the modules
   * the server actually imports and writes them next to `server.js`, which is
   * what lets the runtime stage be a bare `node:22-alpine` with no install step
   * and no chance of the image's dependencies drifting from the lockfile.
   *
   * `public/` and `.next/static/` are *not* included in that trace — they are
   * served by the filesystem rather than imported — so the Dockerfile copies them
   * in explicitly. Forgetting them produces a server that starts cleanly and
   * serves a site with no styles and no favicon.
   */
  output: "standalone",
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ];
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;