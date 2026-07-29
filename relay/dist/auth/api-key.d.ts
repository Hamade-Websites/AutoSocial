import type { AuthPrincipal, ApiKeyRecord, Scope } from "../schemas.ts";
export declare function hashApiKeySecret(secret: string, pepper: string): Buffer;
export declare function createApiKeyAuthenticator(records: ApiKeyRecord[], pepper: string): (rawKey: string) => AuthPrincipal | null;
export declare function requireScope(principal: AuthPrincipal, scope: Scope): void;
export declare function hasScope(principal: AuthPrincipal, scope: Scope): boolean;
//# sourceMappingURL=api-key.d.ts.map