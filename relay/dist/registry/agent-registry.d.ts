import type { AgentConnection, AgentSelectionCriteria } from "../schemas.ts";
export declare class AgentRegistry {
    private agents;
    register(connection: AgentConnection): void;
    remove(agentId: string, connectionId: string): void;
    get(agentId: string): AgentConnection | undefined;
    listForOrg(orgId: string): AgentConnection[];
    selectAgent(criteria: AgentSelectionCriteria): AgentConnection;
    markDraining(agentId: string): void;
}
//# sourceMappingURL=agent-registry.d.ts.map