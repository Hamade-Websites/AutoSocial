import { z } from "zod";
export declare const ScopeSchema: z.ZodEnum<["mcp:read", "mcp:write", "agent:connect"]>;
export type Scope = z.infer<typeof ScopeSchema>;
export declare const PlatformSchema: z.ZodEnum<["tiktok", "instagram", "youtube"]>;
export type Platform = z.infer<typeof PlatformSchema>;
export declare const ToolNameSchema: z.ZodEnum<["list_agents", "list_accounts", "get_queue_status", "post_now", "scheduler_control", "set_schedule", "set_instant_post"]>;
export type ToolName = z.infer<typeof ToolNameSchema>;
export declare const AccountSummarySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    platforms: z.ZodArray<z.ZodEnum<["tiktok", "instagram", "youtube"]>, "many">;
}, "strict", z.ZodTypeAny, {
    id: string;
    name: string;
    platforms: ("tiktok" | "instagram" | "youtube")[];
}, {
    id: string;
    name: string;
    platforms: ("tiktok" | "instagram" | "youtube")[];
}>;
export type AccountSummary = z.infer<typeof AccountSummarySchema>;
export declare const AgentRegisterSchema: z.ZodObject<{
    type: z.ZodLiteral<"agent.register">;
    agentId: z.ZodString;
    agentVersion: z.ZodString;
    tools: z.ZodArray<z.ZodEnum<["list_agents", "list_accounts", "get_queue_status", "post_now", "scheduler_control", "set_schedule", "set_instant_post"]>, "many">;
    accounts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        platforms: z.ZodArray<z.ZodEnum<["tiktok", "instagram", "youtube"]>, "many">;
    }, "strict", z.ZodTypeAny, {
        id: string;
        name: string;
        platforms: ("tiktok" | "instagram" | "youtube")[];
    }, {
        id: string;
        name: string;
        platforms: ("tiktok" | "instagram" | "youtube")[];
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    type: "agent.register";
    agentId: string;
    agentVersion: string;
    tools: ("list_accounts" | "get_queue_status" | "post_now" | "scheduler_control" | "set_schedule" | "set_instant_post" | "list_agents")[];
    accounts: {
        id: string;
        name: string;
        platforms: ("tiktok" | "instagram" | "youtube")[];
    }[];
}, {
    type: "agent.register";
    agentId: string;
    agentVersion: string;
    tools: ("list_accounts" | "get_queue_status" | "post_now" | "scheduler_control" | "set_schedule" | "set_instant_post" | "list_agents")[];
    accounts: {
        id: string;
        name: string;
        platforms: ("tiktok" | "instagram" | "youtube")[];
    }[];
}>;
export type AgentRegister = z.infer<typeof AgentRegisterSchema>;
export declare const AgentRegisteredSchema: z.ZodObject<{
    type: z.ZodLiteral<"agent.registered">;
    connectionId: z.ZodString;
    heartbeatIntervalMs: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    type: "agent.registered";
    heartbeatIntervalMs: number;
    connectionId: string;
}, {
    type: "agent.registered";
    heartbeatIntervalMs: number;
    connectionId: string;
}>;
export type AgentRegistered = z.infer<typeof AgentRegisteredSchema>;
export declare const AgentHeartbeatSchema: z.ZodObject<{
    type: z.ZodLiteral<"agent.heartbeat">;
    status: z.ZodOptional<z.ZodEnum<["healthy", "degraded"]>>;
}, "strict", z.ZodTypeAny, {
    type: "agent.heartbeat";
    status?: "healthy" | "degraded" | undefined;
}, {
    type: "agent.heartbeat";
    status?: "healthy" | "degraded" | undefined;
}>;
export type AgentHeartbeat = z.infer<typeof AgentHeartbeatSchema>;
export declare const AgentHeartbeatAckSchema: z.ZodObject<{
    type: z.ZodLiteral<"agent.heartbeat_ack">;
    receivedAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    type: "agent.heartbeat_ack";
    receivedAt: string;
}, {
    type: "agent.heartbeat_ack";
    receivedAt: string;
}>;
export declare const ToolCallSchema: z.ZodObject<{
    type: z.ZodLiteral<"tool.call">;
    requestId: z.ZodString;
    tool: z.ZodEnum<["list_agents", "list_accounts", "get_queue_status", "post_now", "scheduler_control", "set_schedule", "set_instant_post"]>;
    input: z.ZodUnknown;
}, "strict", z.ZodTypeAny, {
    type: "tool.call";
    requestId: string;
    tool: "list_accounts" | "get_queue_status" | "post_now" | "scheduler_control" | "set_schedule" | "set_instant_post" | "list_agents";
    input?: unknown;
}, {
    type: "tool.call";
    requestId: string;
    tool: "list_accounts" | "get_queue_status" | "post_now" | "scheduler_control" | "set_schedule" | "set_instant_post" | "list_agents";
    input?: unknown;
}>;
export type ToolCall = z.infer<typeof ToolCallSchema>;
export declare const AgentErrorSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    retryable: z.ZodBoolean;
}, "strict", z.ZodTypeAny, {
    code: string;
    message: string;
    retryable: boolean;
}, {
    code: string;
    message: string;
    retryable: boolean;
}>;
export type AgentError = z.infer<typeof AgentErrorSchema>;
export declare const ToolResultSchema: z.ZodEffects<z.ZodObject<{
    type: z.ZodLiteral<"tool.result">;
    requestId: z.ZodString;
    success: z.ZodBoolean;
    result: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        retryable: z.ZodBoolean;
    }, "strict", z.ZodTypeAny, {
        code: string;
        message: string;
        retryable: boolean;
    }, {
        code: string;
        message: string;
        retryable: boolean;
    }>>;
}, "strict", z.ZodTypeAny, {
    type: "tool.result";
    requestId: string;
    success: boolean;
    error?: {
        code: string;
        message: string;
        retryable: boolean;
    } | undefined;
    result?: unknown;
}, {
    type: "tool.result";
    requestId: string;
    success: boolean;
    error?: {
        code: string;
        message: string;
        retryable: boolean;
    } | undefined;
    result?: unknown;
}>, {
    type: "tool.result";
    requestId: string;
    success: boolean;
    error?: {
        code: string;
        message: string;
        retryable: boolean;
    } | undefined;
    result?: unknown;
}, {
    type: "tool.result";
    requestId: string;
    success: boolean;
    error?: {
        code: string;
        message: string;
        retryable: boolean;
    } | undefined;
    result?: unknown;
}>;
export type ToolResult = z.infer<typeof ToolResultSchema>;
export declare const ToolCancelSchema: z.ZodObject<{
    type: z.ZodLiteral<"tool.cancel">;
    requestId: z.ZodString;
    reason: z.ZodEnum<["timeout", "client_cancelled", "shutdown", "agent_disconnected"]>;
}, "strict", z.ZodTypeAny, {
    type: "tool.cancel";
    requestId: string;
    reason: "timeout" | "client_cancelled" | "shutdown" | "agent_disconnected";
}, {
    type: "tool.cancel";
    requestId: string;
    reason: "timeout" | "client_cancelled" | "shutdown" | "agent_disconnected";
}>;
export type ToolCancel = z.infer<typeof ToolCancelSchema>;
export declare const AgentToRelaySchema: z.ZodUnion<[z.ZodObject<{
    type: z.ZodLiteral<"agent.register">;
    agentId: z.ZodString;
    agentVersion: z.ZodString;
    tools: z.ZodArray<z.ZodEnum<["list_agents", "list_accounts", "get_queue_status", "post_now", "scheduler_control", "set_schedule", "set_instant_post"]>, "many">;
    accounts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        platforms: z.ZodArray<z.ZodEnum<["tiktok", "instagram", "youtube"]>, "many">;
    }, "strict", z.ZodTypeAny, {
        id: string;
        name: string;
        platforms: ("tiktok" | "instagram" | "youtube")[];
    }, {
        id: string;
        name: string;
        platforms: ("tiktok" | "instagram" | "youtube")[];
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    type: "agent.register";
    agentId: string;
    agentVersion: string;
    tools: ("list_accounts" | "get_queue_status" | "post_now" | "scheduler_control" | "set_schedule" | "set_instant_post" | "list_agents")[];
    accounts: {
        id: string;
        name: string;
        platforms: ("tiktok" | "instagram" | "youtube")[];
    }[];
}, {
    type: "agent.register";
    agentId: string;
    agentVersion: string;
    tools: ("list_accounts" | "get_queue_status" | "post_now" | "scheduler_control" | "set_schedule" | "set_instant_post" | "list_agents")[];
    accounts: {
        id: string;
        name: string;
        platforms: ("tiktok" | "instagram" | "youtube")[];
    }[];
}>, z.ZodObject<{
    type: z.ZodLiteral<"agent.heartbeat">;
    status: z.ZodOptional<z.ZodEnum<["healthy", "degraded"]>>;
}, "strict", z.ZodTypeAny, {
    type: "agent.heartbeat";
    status?: "healthy" | "degraded" | undefined;
}, {
    type: "agent.heartbeat";
    status?: "healthy" | "degraded" | undefined;
}>, z.ZodEffects<z.ZodObject<{
    type: z.ZodLiteral<"tool.result">;
    requestId: z.ZodString;
    success: z.ZodBoolean;
    result: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        retryable: z.ZodBoolean;
    }, "strict", z.ZodTypeAny, {
        code: string;
        message: string;
        retryable: boolean;
    }, {
        code: string;
        message: string;
        retryable: boolean;
    }>>;
}, "strict", z.ZodTypeAny, {
    type: "tool.result";
    requestId: string;
    success: boolean;
    error?: {
        code: string;
        message: string;
        retryable: boolean;
    } | undefined;
    result?: unknown;
}, {
    type: "tool.result";
    requestId: string;
    success: boolean;
    error?: {
        code: string;
        message: string;
        retryable: boolean;
    } | undefined;
    result?: unknown;
}>, {
    type: "tool.result";
    requestId: string;
    success: boolean;
    error?: {
        code: string;
        message: string;
        retryable: boolean;
    } | undefined;
    result?: unknown;
}, {
    type: "tool.result";
    requestId: string;
    success: boolean;
    error?: {
        code: string;
        message: string;
        retryable: boolean;
    } | undefined;
    result?: unknown;
}>]>;
export type AgentToRelay = z.infer<typeof AgentToRelaySchema>;
export declare const RelayToAgentSchema: z.ZodUnion<[z.ZodObject<{
    type: z.ZodLiteral<"agent.registered">;
    connectionId: z.ZodString;
    heartbeatIntervalMs: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    type: "agent.registered";
    heartbeatIntervalMs: number;
    connectionId: string;
}, {
    type: "agent.registered";
    heartbeatIntervalMs: number;
    connectionId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool.call">;
    requestId: z.ZodString;
    tool: z.ZodEnum<["list_agents", "list_accounts", "get_queue_status", "post_now", "scheduler_control", "set_schedule", "set_instant_post"]>;
    input: z.ZodUnknown;
}, "strict", z.ZodTypeAny, {
    type: "tool.call";
    requestId: string;
    tool: "list_accounts" | "get_queue_status" | "post_now" | "scheduler_control" | "set_schedule" | "set_instant_post" | "list_agents";
    input?: unknown;
}, {
    type: "tool.call";
    requestId: string;
    tool: "list_accounts" | "get_queue_status" | "post_now" | "scheduler_control" | "set_schedule" | "set_instant_post" | "list_agents";
    input?: unknown;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool.cancel">;
    requestId: z.ZodString;
    reason: z.ZodEnum<["timeout", "client_cancelled", "shutdown", "agent_disconnected"]>;
}, "strict", z.ZodTypeAny, {
    type: "tool.cancel";
    requestId: string;
    reason: "timeout" | "client_cancelled" | "shutdown" | "agent_disconnected";
}, {
    type: "tool.cancel";
    requestId: string;
    reason: "timeout" | "client_cancelled" | "shutdown" | "agent_disconnected";
}>]>;
export type RelayToAgent = z.infer<typeof RelayToAgentSchema>;
export declare const AuthPrincipalSchema: z.ZodObject<{
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
export declare const ApiKeyRecordSchema: z.ZodObject<{
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
export declare const SchedulePlanSchema: any;
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
//# sourceMappingURL=schemas.d.ts.map