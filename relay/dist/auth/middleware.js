import { requireScope } from "./api-key.ts";
export function createAuthMiddleware(authenticator) {
    return function authMiddleware(req, res, next) {
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
export function requireScopeMiddleware(scope) {
    return function scopeMiddleware(req, res, next) {
        if (!req.auth) {
            return res.status(401).json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated" } });
        }
        try {
            requireScope(req.auth, scope);
            next();
        }
        catch (e) {
            if (e instanceof Error && "code" in e) {
                return res.status(403).json({ error: { code: "SCOPE_DENIED", message: e.message } });
            }
            throw e;
        }
    };
}
export function createWsAuth(authenticator) {
    return function wsAuth(req, ws, next) {
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
//# sourceMappingURL=middleware.js.map