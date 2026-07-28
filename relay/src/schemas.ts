import { z } from "zod";

export const ScopeSchema = z.enum(["mcp:read", "mcp:write", "agent:connect"]);
export type Scope = z.infer<typeof ScopeSchema>;

export const PlatformSchema = z.enum(["tiktok", "instagram", "youtube"]);
export type Platform = z.infer<typeof PlatformSchema>;

export const ToolNameSchema = z.enum([
  "list_agents",
  "list_accounts",
  "get_queue_status",
  "post_now",
  "scheduler_control",
  "set_schedule",
  "set_instant_post",
]);
export type ToolName = z.infer<typeof ToolNameSchema>;

export const AccountSummarySchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  platforms: z.array(PlatformSchema).min(1),
}).strict();
export type AccountSummary = z.infer<typeof AccountSummarySchema>;

export const AgentRegisterSchema = z.object({
  type: z.literal("agent.register"),
  agentId: z.string().min(1).max(80),
  agentVersion: z.string().min(1).max(40),
  tools: z.array(ToolNameSchema).min(1),
  accounts: z.array(AccountSummarySchema).min(1).max(500),
}).strict();
export type AgentRegister = z.infer<typeof AgentRegisterSchema>;

export const AgentRegisteredSchema = z.object({
  type: z.literal("agent.registered"),
  connectionId: z.string(),
  heartbeatIntervalMs: z.number().int().positive(),
}).strict();
export type AgentRegistered = z.infer<typeof AgentRegisteredSchema>;

export const AgentHeartbeatSchema = z.object({
  type: z.literal("agent.heartbeat"),
  status: z.enum(["healthy", "degraded"]).optional(),
}).strict();
export type AgentHeartbeat = z.infer<typeof AgentHeartbeatSchema>;

export const AgentHeartbeatAckSchema = z.object({
  type: z.literal("agent.heartbeat_ack"),
  receivedAt: z.string().datetime(),
}).strict();

export const ToolCallSchema = z.object({
  type: z.literal("tool.call"),
  requestId: z.string(),
  tool: ToolNameSchema,
  input: z.unknown(),
}).strict();
export type ToolCall = z.infer<typeof ToolCallSchema>;

export const AgentErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
}).strict();
export type AgentError = z.infer<typeof AgentErrorSchema>;

export const ToolResultSchema = z.object({
  type: z.literal("tool.result"),
  requestId: z.string(),
  success: z.boolean(),
  result: z.unknown().optional(),
  error: AgentErrorSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.success && value.result === undefined) {
    ctx.addIssue({ code: "custom", message: "Successful result is required" });
  }
  if (!value.success && value.error === undefined) {
    ctx.addIssue({ code: "custom", message: "Failed result must include error" });
  }
});
export type ToolResult = z.infer<typeof ToolResultSchema>;

export const ToolCancelSchema = z.object({
  type: z.literal("tool.cancel"),
  requestId: z.string(),
  reason: z.enum(["timeout", "client_cancelled", "shutdown", "agent_disconnected"]),
}).strict();
export type ToolCancel = z.infer<typeof ToolCancelSchema>;

export const AgentToRelaySchema = z.union([
  AgentRegisterSchema,
  AgentHeartbeatSchema,
  ToolResultSchema,
]);
export type AgentToRelay = z.infer<typeof AgentToRelaySchema>;

export const RelayToAgentSchema = z.union([
  AgentRegisteredSchema,
  ToolCallSchema,
  ToolCancelSchema,
]);
export type RelayToAgent = z.infer<typeof RelayToAgentSchema>;

export const AuthPrincipalSchema = z.object({
  keyId: z.string(),
  orgId: z.string(),
  scopes: z.array(ScopeSchema),
}).strict();
export type AuthPrincipal = z.infer<typeof AuthPrincipalSchema>;

export const ApiKeyRecordSchema = z.object({
  keyId: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/),
  orgId: z.string().regex(/^org_[A-Za-z0-9_-]{3,64}$/),
  secretHash: z.string().regex(/^[a-f0-9]{64}$/),
  scopes: z.array(ScopeSchema).min(1),
  enabled: z.boolean().default(true),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  environment: z.enum(["test", "live"]).default("live"),
}).strict();
export type ApiKeyRecord = z.infer<typeof ApiKeyRecordSchema>;

export const SchedulePlanSchema = z.union([
  z.object({ type: z.literal("cron"), expression: z.string().min(1).max(200) }),
  z.object({ type: z.literal("daily-times"), times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).min(1).max(24) }),
]).strict();
export type SchedulePlan = z.infer<typeof SchedulePlanSchema>;

export interface AgentSelectionCriteria {
  orgId: string;
  tool: ToolName;
  accountId?: string;
  agentId?: string;
}

export interface AgentConnection {
  connectionId: string;
  agentId: string;
  orgId: string;
  agentVersion: string;
  tools: ReadonlySet<ToolName>;
  accounts: ReadonlyMap<string, AccountSummary>;
  status: "healthy" | "degraded" | "draining";
  connectedAt: number;
  lastHeartbeatAt: number;
  socket: any;
}

export type RelayErrorCode =
  | "INVALID_ARGUMENT"
  | "SCOPE_DENIED"
  | "AGENT_NOT_FOUND"
  | "AGENT_UNAVAILABLE"
  | "AGENT_AMBIGUOUS"
  | "AGENT_CAPABILITY_MISSING"
  | "ACCOUNT_NOT_FOUND"
  | "RATE_LIMITED"
  | "TOO_MANY_INFLIGHT"
  | "AGENT_TIMEOUT"
  | "AGENT_DISCONNECTED"
  | "CLIENT_CANCELLED"
  | "PROTOCOL_ERROR"
  | "INTERNAL_ERROR"
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "MCP_SESSION_NOT_FOUND"
  | "SERVER_NOT_READY";