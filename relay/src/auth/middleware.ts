import { Request, Response, NextFunction } from "express";
import { RelayError, RelayErrorCode } from "../errors.ts";
import type { AuthPrincipal } from "../schemas.ts";
import { createApiKeyAuthenticator, requireScope } from "./api-key.ts";

export interface AuthRequest extends Request {
  auth?: AuthPrincipal;
}

export function createAuthMiddleware(
  authenticator: (key: string) => AuthPrincipal | null
) {
  return function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: { code: "AUTH_REQUIRED", message: "Authorization header required" } });
    }

    const key = authHeader.slice(7);
    const principal = authenticator(key);
    if (!principal) {
      return res.status(401).json({ error: { code: "AUTH_INVALID", message: "Invalid or expired API key" } });
    }

    req.auth = principal;
    next();
  };
}

export function requireScopeMiddleware(scope: string) {
  return function scopeMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.auth) {
      return res.status(401).json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated" } });
    }

    try {
      requireScope(req.auth, scope as any);
      next();
    } catch (e) {
      if (e instanceof Error && "code" in e) {
        return res.status(403).json({ error: { code: "SCOPE_DENIED", message: e.message } });
      }
      throw e;
    }
  };
}

export function createWsAuth(authenticator: (key: string) => AuthPrincipal | null) {
  return function wsAuth(req: any, ws: any, next: (err?: Error) => void) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      ws.close(4001, "Authorization header required");
      return;
    }

    const key = authHeader.slice(7);
    const principal = authenticator(key);
    if (!principal) {
      ws.close(4001, "Invalid or expired API key");
      return;
    }

    req.auth = principal;
    next();
  };
}