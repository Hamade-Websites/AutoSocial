import { z } from "zod";

const ScopeSchema = z.enum(["mcp:read", "mcp:write", "agent:connect"]);
export type Scope = z.infer<typeof ScopeSchema>;

export const PlatformSchema = z.enum(["tiktok", "instagram", "youtube"]);
export type Platform = z.infer<typeof PlatformSchema>;

export const ToolNameSchema = z.enum([
  "list_accounts",
  "get_queue_status",
  "post_now",
  "scheduler_control",
  "set_schedule",
  "set_instant_post",
]);
export type ToolName = z.infer<typeof ToolNameSchema>;

const ApiKeyRecordSchema = z.object({
  keyId: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/),
  orgId: z.string().regex(/^org_[A-Za-z0-9_-]{3,64}$/),
  secretHash: z.string().regex(/^[a-f0-9]{64}$/),
  scopes: z.array(ScopeSchema).min(1),
  enabled: z.boolean().default(true),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  environment: z.enum(["test", "live"]).default("live"),
}).strict();

export type ApiKeyRecord = z.infer<typeof ApiKeyRecordSchema>;

const ApiKeyRecordsSchema = z.array(ApiKeyRecordSchema).refine(
  (records) => new Set(records.map(r => r.keyId)).size === records.length,
  { message: "Duplicate keyId values in RELAY_API_KEYS_JSON" }
);

const AuthPrincipalSchema = z.object({
  keyId: z.string(),
  orgId: z.string(),
  scopes: z.array(ScopeSchema),
}).strict();

export type AuthPrincipal = z.infer<typeof AuthPrincipalSchema>;

const RelayConfigSchema = z.object({
  host: z.string().default("0.0.0.0"),
  port: z.number().int().min(1).max(65535).default(8080),
  publicUrl: z.string().url(),
  env: z.enum(["development", "test", "production"]).default("development"),
  apiKeyPepper: z.string().min(32),
  apiKeysJson: z.string().min(2),
  toolTimeoutMs: z.number().int().min(1000).max(600000).default(120000),
  registerTimeoutMs: z.number().int().min(1000).max(30000).default(5000),
  heartbeatIntervalMs: z.number().int().min(5000).max(120000).default(30000),
  agentStaleMs: z.number().int().min(10000).max(300000).default(90000),
  maxBodyBytes: z.number().int().min(1024).max(1048576).default(262144),
  maxWsMessageBytes: z.number().int().min(1024).max(1048576).default(262144),
  maxInflightPerAgent: z.number().int().min(1).max(100).default(16),
  maxInflightPerOrg: z.number().int().min(1).max(1000).default(64),
  rateLimitPerMinute: z.number().int().min(1).max(10000).default(120),
  shutdownGraceMs: z.number().int().min(1000).max(60000).default(10000),
  logLevel: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  trustProxy: z.boolean().default(false),
}).strict();

export type RelayConfig = z.infer<typeof RelayConfigSchema>;

function parseApiKeys(json: string): ApiKeyRecord[] {
  const parsed = JSON.parse(json);
  return ApiKeyRecordsSchema.parse(parsed);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RelayConfig & { apiKeys: ApiKeyRecord[] } {
  const raw = {
    host: env.RELAY_HOST ?? "0.0.0.0",
    port: parseInt(env.RELAY_PORT ?? "8080", 10),
    publicUrl: env.RELAY_PUBLIC_URL,
    env: (env.RELAY_ENV as RelayConfig["env"]) ?? "development",
    apiKeyPepper: env.RELAY_API_KEY_PEPPER,
    apiKeysJson: env.RELAY_API_KEYS_JSON,
    toolTimeoutMs: parseInt(env.RELAY_TOOL_TIMEOUT_MS ?? "120000", 10),
    registerTimeoutMs: parseInt(env.RELAY_REGISTER_TIMEOUT_MS ?? "5000", 10),
    heartbeatIntervalMs: parseInt(env.RELAY_HEARTBEAT_INTERVAL_MS ?? "30000", 10),
    agentStaleMs: parseInt(env.RELAY_AGENT_STALE_MS ?? "90000", 10),
    maxBodyBytes: parseInt(env.RELAY_MAX_BODY_BYTES ?? "262144", 10),
    maxWsMessageBytes: parseInt(env.RELAY_MAX_WS_MESSAGE_BYTES ?? "262144", 10),
    maxInflightPerAgent: parseInt(env.RELAY_MAX_INFLIGHT_PER_AGENT ?? "16", 10),
    maxInflightPerOrg: parseInt(env.RELAY_MAX_INFLIGHT_PER_ORG ?? "64", 10),
    rateLimitPerMinute: parseInt(env.RELAY_RATE_LIMIT_PER_MINUTE ?? "120", 10),
    shutdownGraceMs: parseInt(env.RELAY_SHUTDOWN_GRACE_MS ?? "10000", 10),
    logLevel: (env.RELAY_LOG_LEVEL as RelayConfig["logLevel"]) ?? "info",
    trustProxy: env.RELAY_TRUST_PROXY === "true",
  };

  const result = RelayConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid relay configuration: ${issues}`);
  }

  if (result.data.env === "production" && !result.data.publicUrl.startsWith("https://")) {
    throw new Error("RELAY_PUBLIC_URL must use HTTPS in production");
  }

  if (result.data.agentStaleMs <= result.data.heartbeatIntervalMs * 2) {
    throw new Error("RELAY_AGENT_STALE_MS must be greater than 2 * RELAY_HEARTBEAT_INTERVAL_MS");
  }

  const apiKeys = parseApiKeys(result.data.apiKeysJson);

  return {
    ...result.data,
    apiKeys,
  };
}