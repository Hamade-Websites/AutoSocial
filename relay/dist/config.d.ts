import { z } from "zod";
declare const ScopeSchema: z.ZodEnum<["mcp:read", "mcp:write", "agent:connect"]>;
export type Scope = z.infer<typeof ScopeSchema>;
export declare const PlatformSchema: z.ZodEnum<["tiktok", "instagram", "youtube"]>;
export type Platform = z.infer<typeof PlatformSchema>;
export declare const ToolNameSchema: z.ZodEnum<["list_accounts", "get_queue_status", "post_now", "scheduler_control", "set_schedule", "set_instant_post"]>;
export type ToolName = z.infer<typeof ToolNameSchema>;
declare const ApiKeyRecordSchema: z.ZodObject<{
    keyId: z.ZodString;
    orgId: z.ZodString;
    secretHash: z.ZodString;
    scopes: z.ZodArray<z.ZodEnum<["mcp:read", "mcp:write", "agent:connect"]>, "many">;
    enabled: z.ZodDefault<z.ZodBoolean>;
    expiresAt: z.ZodOptional<z.ZodString>;
    environment: z.ZodDefault<z.ZodEnum<["test", "live"]>>;
}, "strict", z.ZodTypeAny, {
    keyId: string;
    orgId: string;
    secretHash: string;
    scopes: ("mcp:read" | "mcp:write" | "agent:connect")[];
    enabled: boolean;
    environment: "test" | "live";
    expiresAt?: string | undefined;
}, {
    keyId: string;
    orgId: string;
    secretHash: string;
    scopes: ("mcp:read" | "mcp:write" | "agent:connect")[];
    enabled?: boolean | undefined;
    expiresAt?: string | undefined;
    environment?: "test" | "live" | undefined;
}>;
export type ApiKeyRecord = z.infer<typeof ApiKeyRecordSchema>;
declare const AuthPrincipalSchema: z.ZodObject<{
    keyId: z.ZodString;
    orgId: z.ZodString;
    scopes: z.ZodArray<z.ZodEnum<["mcp:read", "mcp:write", "agent:connect"]>, "many">;
}, "strict", z.ZodTypeAny, {
    keyId: string;
    orgId: string;
    scopes: ("mcp:read" | "mcp:write" | "agent:connect")[];
}, {
    keyId: string;
    orgId: string;
    scopes: ("mcp:read" | "mcp:write" | "agent:connect")[];
}>;
export type AuthPrincipal = z.infer<typeof AuthPrincipalSchema>;
declare const RelayConfigSchema: z.ZodObject<{
    host: z.ZodDefault<z.ZodString>;
    port: z.ZodDefault<z.ZodNumber>;
    publicUrl: z.ZodString;
    env: z.ZodDefault<z.ZodEnum<["development", "test", "production"]>>;
    apiKeyPepper: z.ZodString;
    apiKeysJson: z.ZodString;
    toolTimeoutMs: z.ZodDefault<z.ZodNumber>;
    registerTimeoutMs: z.ZodDefault<z.ZodNumber>;
    heartbeatIntervalMs: z.ZodDefault<z.ZodNumber>;
    agentStaleMs: z.ZodDefault<z.ZodNumber>;
    maxBodyBytes: z.ZodDefault<z.ZodNumber>;
    maxWsMessageBytes: z.ZodDefault<z.ZodNumber>;
    maxInflightPerAgent: z.ZodDefault<z.ZodNumber>;
    maxInflightPerOrg: z.ZodDefault<z.ZodNumber>;
    rateLimitPerMinute: z.ZodDefault<z.ZodNumber>;
    shutdownGraceMs: z.ZodDefault<z.ZodNumber>;
    logLevel: z.ZodDefault<z.ZodEnum<["fatal", "error", "warn", "info", "debug", "trace"]>>;
    trustProxy: z.ZodDefault<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    host: string;
    port: number;
    publicUrl: string;
    env: "test" | "development" | "production";
    apiKeyPepper: string;
    apiKeysJson: string;
    toolTimeoutMs: number;
    registerTimeoutMs: number;
    heartbeatIntervalMs: number;
    agentStaleMs: number;
    maxBodyBytes: number;
    maxWsMessageBytes: number;
    maxInflightPerAgent: number;
    maxInflightPerOrg: number;
    rateLimitPerMinute: number;
    shutdownGraceMs: number;
    logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
    trustProxy: boolean;
}, {
    publicUrl: string;
    apiKeyPepper: string;
    apiKeysJson: string;
    host?: string | undefined;
    port?: number | undefined;
    env?: "test" | "development" | "production" | undefined;
    toolTimeoutMs?: number | undefined;
    registerTimeoutMs?: number | undefined;
    heartbeatIntervalMs?: number | undefined;
    agentStaleMs?: number | undefined;
    maxBodyBytes?: number | undefined;
    maxWsMessageBytes?: number | undefined;
    maxInflightPerAgent?: number | undefined;
    maxInflightPerOrg?: number | undefined;
    rateLimitPerMinute?: number | undefined;
    shutdownGraceMs?: number | undefined;
    logLevel?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | undefined;
    trustProxy?: boolean | undefined;
}>;
export type RelayConfig = z.infer<typeof RelayConfigSchema>;
export declare function loadConfig(env?: NodeJS.ProcessEnv): RelayConfig & {
    apiKeys: ApiKeyRecord[];
};
export {};
//# sourceMappingURL=config.d.ts.map