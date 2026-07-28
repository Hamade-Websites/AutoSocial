import { RelayErrorCode } from "../errors.ts";
import type { AuthPrincipal, AgentConnection, ToolName } from "../schemas.ts";
import { PendingRequestStore } from "../pending/pending-requests.ts";
import { AgentRegistry } from "../registry/agent-registry.ts";
export interface ToolCallContext {
    requestId: string;
    agent: AgentConnection;
    principal: AuthPrincipal;
    deadline: number;
    abortSignal: AbortSignal;
}
export type ToolHandler = (principal: AuthPrincipal, input: unknown, context: ToolCallContext) => Promise<{
    success: true;
    result: unknown;
} | {
    success: false;
    error: {
        code: RelayErrorCode;
        message: string;
        retryable: boolean;
    };
}>;
export declare class ToolRouter {
    private readonly pendingRequests;
    private readonly agentRegistry;
    private localTools;
    private toolScopes;
    constructor(pendingRequests: PendingRequestStore, agentRegistry: AgentRegistry);
    registerLocalTool(name: ToolName, scope: string, handler: ToolHandler): void;
    getScope(name: ToolName): string | undefined;
    routeToolCall(principal: AuthPrincipal, toolName: ToolName, input: unknown, context: ToolCallContext): Promise<{
        success: true;
        result: unknown;
    } | {
        success: false;
        error: {
            code: RelayErrorCode;
            message: string;
            retryable: boolean;
        };
    }>;
    private handleListAgents;
    private handleListAccounts;
    private handleGetQueueStatus;
    private handlePostNow;
    private handleSchedulerControl;
    private handleSetSchedule;
    private handleSetInstantPost;
}
//# sourceMappingURL=tool-router.d.ts.map