import { createHmac, timingSafeEqual } from "crypto";
import { RelayError } from "../errors.ts";
export function hashApiKeySecret(secret, pepper) {
    return createHmac("sha256", pepper).update(secret).digest();
}
export function createApiKeyAuthenticator(records, pepper) {
    const byKeyId = new Map(records.map(r => [r.keyId, r]));
    return function authenticate(rawKey) {
        const parts = rawKey.split("_");
        if (parts.length !== 3 || parts[0] !== "as") {
            return null;
        }
        const [, env, keyId, secret] = parts;
        if (!["test", "live"].includes(env)) {
            return null;
        }
        const record = byKeyId.get(keyId);
        if (!record || !record.enabled) {
            return null;
        }
        if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
            return null;
        }
        if (record.environment !== env) {
            return null;
        }
        const expectedHash = hashApiKeySecret(secret, pepper);
        const actualHash = Buffer.from(record.secretHash, "hex");
        if (expectedHash.length !== actualHash.length || !timingSafeEqual(expectedHash, actualHash)) {
            return null;
        }
        return {
            keyId: record.keyId,
            orgId: record.orgId,
            scopes: new Set(record.scopes),
            environment: record.environment,
        };
    };
}
export function requireScope(principal, scope) {
    if (!principal.scopes.has(scope)) {
        throw new RelayError("SCOPE_DENIED", `Required scope: ${scope}`, { scope }, false);
    }
}
export function hasScope(principal, scope) {
    return principal.scopes.has(scope);
}
//# sourceMappingURL=api-key.js.map