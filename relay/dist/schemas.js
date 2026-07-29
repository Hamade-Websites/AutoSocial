import { z } from "zod";
export const ScopeSchema = z.enum(["mcp:read", "mcp:write", "agent:connect"]);
export const PlatformSchema = z.enum(["tiktok", "instagram", "youtube"]);
export const ToolNameSchema = z.enum([
    "list_agents",
    "list_accounts",
    "get_queue_status",
    "post_now",
    "scheduler_control",
    "set_schedule",
    "set_instant_post",
]);
export const AccountSummarySchema = z.object({
    id: z.string().min(1).max(80),
    name: z.string().min(1).max(120),
    platforms: z.array(PlatformSchema).min(1),
}).strict();
export const AgentRegisterSchema = z.object({
    type: z.literal("agent.register"),
    agentId: z.string().min(1).max(80),
    agentVersion: z.string().min(1).max(40),
    tools: z.array(ToolNameSchema).min(1),
    accounts: z.array(AccountSummarySchema).min(1).max(500),
}).strict();
export const AgentRegisteredSchema = z.object({
    type: z.literal("agent.registered"),
    connectionId: z.string(),
    heartbeatIntervalMs: z.number().int().positive(),
}).strict();
export const AgentHeartbeatSchema = z.object({
    type: z.literal("agent.heartbeat"),
    status: z.enum(["healthy", "degraded"]).optional(),
}).strict();
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
export const AgentErrorSchema = z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
}).strict();
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
export const ToolCancelSchema = z.object({
    type: z.literal("tool.cancel"),
    requestId: z.string(),
    reason: z.enum(["timeout", "client_cancelled", "shutdown", "agent_disconnected"]),
}).strict();
export const AgentToRelaySchema = z.union([
    AgentRegisterSchema,
    AgentHeartbeatSchema,
    ToolResultSchema,
]);
export const RelayToAgentSchema = z.union([
    AgentRegisteredSchema,
    ToolCallSchema,
    ToolCancelSchema,
]);
export const AuthPrincipalSchema = z.object({
    keyId: z.string(),
    orgId: z.string(),
    scopes: z.array(ScopeSchema),
}).strict();
export const ApiKeyRecordSchema = z.object({
    keyId: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/),
    orgId: z.string().regex(/^org_[A-Za-z0-9_-]{3,64}$/),
    secretHash: z.string().regex(/^[a-f0-9]{64}$/),
    scopes: z.array(ScopeSchema).min(1),
    enabled: z.boolean().default(true),
    expiresAt: z.string().datetime({ offset: true }).optional(),
    environment: z.enum(["test", "live"]).default("live"),
}).strict();
export const SchedulePlanSchema = z.union([
    z.object({ type: z.literal("cron"), expression: z.string().min(1).max(200) }),
    z.object({ type: z.literal("daily-times"), times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).min(1).max(24) }),
]).strict();
//# sourceMappingURL=schemas.js.map