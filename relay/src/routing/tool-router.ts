import { RelayError, RelayErrorCode } from "../errors.ts";
import type { AuthPrincipal, AgentConnection, ToolName, Platform, SchedulePlan } from "../schemas.ts";
import { PendingRequestStore } from "../pending/pending-requests.ts";
import { AgentRegistry } from "../registry/agent-registry.ts";

export interface ToolCallContext {
  requestId: string;
  agent: AgentConnection;
  principal: AuthPrincipal;
  deadline: number;
  abortSignal: AbortSignal;
}

export type ToolHandler = (
  principal: AuthPrincipal,
  input: unknown,
  context: ToolCallContext
) => Promise<{ success: true; result: unknown } | { success: false; error: { code: RelayErrorCode; message: string; retryable: boolean } }>;

export class ToolRouter {
  private localTools = new Map<ToolName, ToolHandler>();
  private toolScopes = new Map<ToolName, string>();

  constructor(
    private readonly pendingRequests: PendingRequestStore,
    private readonly agentRegistry: AgentRegistry
  ) {
    this.registerLocalTool("list_agents", "mcp:read", this.handleListAgents.bind(this));
    this.registerLocalTool("list_accounts", "mcp:read", this.handleListAccounts.bind(this));
    this.registerLocalTool("get_queue_status", "mcp:read", this.handleGetQueueStatus.bind(this));
    this.registerLocalTool("post_now", "mcp:write", this.handlePostNow.bind(this));
    this.registerLocalTool("scheduler_control", "mcp:write", this.handleSchedulerControl.bind(this));
    this.registerLocalTool("set_schedule", "mcp:write", this.handleSetSchedule.bind(this));
    this.registerLocalTool("set_instant_post", "mcp:write", this.handleSetInstantPost.bind(this));
  }

  registerLocalTool(name: ToolName, scope: string, handler: ToolHandler): void {
    this.localTools.set(name, handler);
    this.toolScopes.set(name, scope);
  }

  getScope(name: ToolName): string | undefined {
    return this.toolScopes.get(name);
  }

  async routeToolCall(
    principal: AuthPrincipal,
    toolName: ToolName,
    input: unknown,
    context: ToolCallContext
  ): Promise<{ success: true; result: unknown } | { success: false; error: { code: RelayErrorCode; message: string; retryable: boolean } }> {
    const localHandler = this.localTools.get(toolName);
    if (localHandler) {
      const scope = this.toolScopes.get(toolName);
      if (scope && !principal.scopes.has(scope as any)) {
        throw new RelayError("SCOPE_DENIED", `Required scope: ${scope}`, { tool: toolName, scope }, false);
      }
      return localHandler(principal, input, context);
    }

    const selection: AgentSelectionCriteria = {
      orgId: principal.orgId,
      tool: toolName,
      accountId: (input as any)?.account_id,
      agentId: (input as any)?.agent_id,
    };

    let agent: AgentConnection;
    try {
      agent = this.agentRegistry.selectAgent(selection);
    } catch (e) {
      if (e instanceof RelayError) throw e;
      throw new RelayError("AGENT_UNAVAILABLE", "No agent available", { tool: toolName }, true);
    }

    if (!agent.tools.has(toolName)) {
      throw new RelayError("AGENT_CAPABILITY_MISSING", `Agent does not support tool: ${toolName}`, { agentId: agent.agentId }, false);
    }

    if (agent.status === "draining" || agent.status === "degraded") {
      throw new RelayError("AGENT_UNAVAILABLE", `Agent is ${agent.status}`, { agentId: agent.agentId }, true);
    }

    const deadline = Date.now() + 120000;
    const promise = this.pendingRequests.create(
      { requestId: context.requestId, toolName, deadline, abortSignal: context.abortSignal },
      agent.agentId,
      principal.orgId
    );

    const message = {
      type: "tool.call" as const,
      requestId: context.requestId,
      tool: toolName,
      input,
    };

    try {
      agent.socket.send(JSON.stringify(message));
    } catch (e) {
      this.pendingRequests.cancel(context.requestId, "agent_disconnected");
      throw new RelayError("AGENT_DISCONNECTED", "Failed to send to agent", {}, true);
    }

    const result = await promise;
    return result.success
      ? { success: true, result: result.result }
      : { success: false, error: result.error };
  }

  private async handleListAgents(principal: AuthPrincipal) {
    const includeDegraded = false;
    const agents = this.agentRegistry.listForOrg(principal.orgId)
      .filter(a => includeDegraded || a.status === "healthy")
      .map(a => ({
        agent_id: a.agentId,
        status: a.status,
        agent_version: a.agentVersion,
        tools: Array.from(a.tools),
        accounts: Array.from(a.accounts.values()),
        last_heartbeat_at: new Date(a.lastHeartbeatAt).toISOString(),
      }));
    return { success: true, result: { agents } };
  }

  private async handleListAccounts(principal: AuthPrincipal, input: unknown) {
    const agentId = (input as any)?.agent_id;
    let agent: AgentConnection;

    if (agentId) {
      const a = this.agentRegistry.get(agentId);
      if (!a || a.orgId !== principal.orgId) {
        throw new RelayError("AGENT_NOT_FOUND", "Agent not found", { agentId });
      }
      agent = a;
    } else {
      const agents = this.agentRegistry.listForOrg(principal.orgId).filter(a => a.status === "healthy");
      if (agents.length === 0) throw new RelayError("AGENT_UNAVAILABLE", "No healthy agents");
      if (agents.length > 1) throw new RelayError("AGENT_AMBIGUOUS", "Multiple agents available; specify agent_id");
      agent = agents[0];
    }

    const accounts = Array.from(agent.accounts.values()).map(a => ({ id: a.id, name: a.name, platforms: a.platforms }));
    return { success: true, result: { accounts } };
  }

  private async handleGetQueueStatus(principal: AuthPrincipal, input: unknown) {
    const { account_id, platform, agent_id } = input as any;

    let agent: AgentConnection;
    if (agent_id) {
      const a = this.agentRegistry.get(agent_id);
      if (!a || a.orgId !== principal.orgId) throw new RelayError("AGENT_NOT_FOUND", "Agent not found", { agent_id });
      agent = a;
    } else {
      const agents = this.agentRegistry.listForOrg(principal.orgId).filter(a => a.status === "healthy" && a.tools.has("get_queue_status"));
      if (agents.length === 0) throw new RelayError("AGENT_UNAVAILABLE", "No agent supports get_queue_status");
      if (agents.length > 1 && !agent_id) throw new RelayError("AGENT_AMBIGUOUS", "Multiple agents available; specify agent_id");
      agent = agents[0];
    }

    return { success: true, result: { forwarded: true, agent_id: agent.agentId } };
  }

  private async handlePostNow(principal: AuthPrincipal, input: unknown) {
    const { account_id, platform, agent_id } = input as any;
    const { account_id: _, platform: _p, agent_id: _a, ...forward } = input;

    return { success: true, result: { forwarded: true, tool: "post_now", account_id, platform, agent_id } };
  }

  private async handleSchedulerControl(principal: AuthPrincipal, input: unknown) {
    const { account_id, platform, action, agent_id } = input as any;
    return { success: true, result: { forwarded: true, tool: "scheduler_control", account_id, platform, action, agent_id } };
  }

  private async handleSetSchedule(principal: AuthPrincipal, input: unknown) {
    const { account_id, platform, schedule, agent_id } = input as any;
    return { success: true, result: { forwarded: true, tool: "set_schedule", account_id, platform, schedule, agent_id } };
  }

  private async handleSetInstantPost(principal: AuthPrincipal, input: unknown) {
    const { account_id, platform, enabled, agent_id } = input as any;
    return { success: true, result: { forwarded: true, tool: "set_instant_post", account_id, platform, enabled, agent_id } };
  }
}