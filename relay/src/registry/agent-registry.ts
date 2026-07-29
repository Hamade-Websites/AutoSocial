import { RelayError, RelayErrorCode } from "../errors.ts";
import type { AgentConnection, AgentSelectionCriteria, ToolName } from "../schemas.ts";

export class AgentRegistry {
  private agents = new Map<string, AgentConnection>();

  register(connection: AgentConnection): void {
    const existing = this.agents.get(connection.agentId);
    if (existing) {
      this.remove(connection.agentId, existing.connectionId);
    }
    this.agents.set(connection.agentId, connection);
  }

  remove(agentId: string, connectionId: string): void {
    const existing = this.agents.get(agentId);
    if (existing && existing.connectionId === connectionId) {
      this.agents.delete(agentId);
    }
  }

  get(agentId: string): AgentConnection | undefined {
    return this.agents.get(agentId);
  }

  listForOrg(orgId: string): AgentConnection[] {
    const result: AgentConnection[] = [];
    for (const agent of this.agents.values()) {
      if (agent.orgId === orgId) {
        result.push(agent);
      }
    }
    return result;
  }

  selectAgent(criteria: AgentSelectionCriteria): AgentConnection {
    let candidates = this.listForOrg(criteria.orgId).filter(a =>
      a.status === "healthy" && a.tools.has(criteria.tool)
    );

    if (criteria.accountId) {
      candidates = candidates.filter(a => a.accounts.has(criteria.accountId!));
    }

    if (criteria.agentId) {
      candidates = candidates.filter(a => a.agentId === criteria.agentId);
      if (candidates.length === 0) {
        throw new RelayError("AGENT_NOT_FOUND", "Specified agent not found or not healthy", { agentId: criteria.agentId });
      }
    }

    if (candidates.length === 0) {
      throw new RelayError("AGENT_UNAVAILABLE", "No healthy agent available with required capability", { tool: criteria.tool });
    }

    if (candidates.length > 1) {
      throw new RelayError("AGENT_AMBIGUOUS", "Multiple agents match; specify agent_id", {
        candidates: candidates.map(a => a.agentId),
      });
    }

    return candidates[0];
  }

  markDraining(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) agent.status = "draining";
  }
}