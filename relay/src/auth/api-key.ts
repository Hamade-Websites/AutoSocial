import { createHmac, timingSafeEqual } from "crypto";
import { RelayError } from "../errors.ts";
import type { AuthPrincipal, ApiKeyRecord, Scope, RelayErrorCode } from "../schemas.ts";

export function hashApiKeySecret(secret: string, pepper: string): Buffer {
  return createHmac("sha256", pepper).update(secret).digest();
}

export function createApiKeyAuthenticator(records: ApiKeyRecord[], pepper: string) {
  const byKeyId = new Map(records.map(r => [r.keyId, r]));

  return function authenticate(rawKey: string): AuthPrincipal | null {
    if (!rawKey.startsWith("as:")) return null;
    
    const afterPrefix = rawKey.slice(3);
    const parts = afterPrefix.split(":");
    if (parts.length !== 3) return null;
    
    const [env, keyId, secret] = parts;
    if (!["test", "live"].includes(env)) return null;
    if (!secret) return null;

    const record = byKeyId.get(keyId);
    if (!record || !record.enabled) return null;

    if (record.expiresAt && new Date(record.expiresAt) < new Date()) return null;

    if (record.environment !== env) return null;

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

export function requireScope(principal: AuthPrincipal, scope: Scope): void {
  if (!principal.scopes.has(scope)) {
    throw new RelayError("SCOPE_DENIED" as RelayErrorCode, `Required scope: ${scope}`, { scope }, false);
  }
}

export function hasScope(principal: AuthPrincipal, scope: Scope): boolean {
  return principal.scopes.has(scope);
}