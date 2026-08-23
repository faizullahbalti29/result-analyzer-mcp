import { Request, Response, NextFunction } from "express";
import { auth, UnauthorizedError, InvalidTokenError } from "express-oauth2-jwt-bearer";
import "dotenv/config";

// Helper to determine public URL
export function getPublicUrl(req: Request): string {
  if (process.env.MCP_PUBLIC_URL) {
    return process.env.MCP_PUBLIC_URL.replace(/\/$/, "");
  }
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000";
  return `${protocol}://${host}`;
}

const auth0Domain = (process.env.AUTH0_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const auth0Audience = process.env.AUTH0_AUDIENCE;

export const isOAuthEnabled = process.env.ENABLE_OAUTH !== "0";

if (!auth0Domain && isOAuthEnabled) {
  console.warn("⚠️ AUTH0_DOMAIN is not set in environment variables.");
}

const issuerBaseURL = `https://${auth0Domain}`;

// Audience list: support primary audience and userinfo/domain audience fallback
const validAudiences = auth0Audience
  ? [auth0Audience, `${issuerBaseURL}/userinfo`]
  : [`${issuerBaseURL}/userinfo`];

const jwtCheck = auth({
  issuerBaseURL,
  audience: validAudiences.length === 1 ? validAudiences[0] : validAudiences,
  tokenSigningAlg: "RS256",
  authRequired: true,
});

/**
 * Authentication middleware that verifies JWT tokens from Auth0.
 * On failure or missing token, responds with HTTP 401 and RFC 9728 WWW-Authenticate header.
 */
export function validateAccessToken(req: Request, res: Response, next: NextFunction) {
  // If OAuth is disabled (ENABLE_OAUTH=0), bypass authentication
  if (!isOAuthEnabled) {
    return next();
  }

  // Allow preflight OPTIONS requests without auth
  if (req.method === "OPTIONS") {
    return next();
  }

  const publicUrl = getPublicUrl(req);
  const metadataUrl = `${publicUrl}/.well-known/oauth-protected-resource`;

  jwtCheck(req, res, (err) => {
    if (err) {
      console.warn(`[AUTH] Unauthorized request to ${req.method} ${req.path}:`, err.message || err);

      res.setHeader(
        "WWW-Authenticate",
        `Bearer error="invalid_token", error_description="${encodeURIComponent(
          err.message || "Unauthorized"
        )}", resource_metadata="${metadataUrl}"`
      );

      return res.status(401).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Unauthorized: Valid Auth0 Bearer token required",
          data: {
            auth_server: issuerBaseURL,
            resource_metadata: metadataUrl,
          },
        },
        id: null,
      });
    }

    next();
  });
}