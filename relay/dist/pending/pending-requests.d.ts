import { RelayError } from "../errors.ts";
export interface PendingRequestInput {
    requestId: string;
    toolName: string;
    deadline: number;
    abortSignal: AbortSignal;
}
export declare class PendingRequestStore {
    private readonly maxInflightPerAgent;
    private readonly maxInflightPerOrg;
    private readonly toolTimeoutMs;
    private pending;
    private perAgent;
    private perOrg;
    constructor(maxInflightPerAgent: number, maxInflightPerOrg: number, toolTimeoutMs: number);
    create(input: PendingRequestInput, agentId: string, orgId: string): Promise<any>;
    private addToAgent;
    private addToOrg;
    private cleanup;
    resolve(message: {
        requestId: string;
        success: boolean;
        result?: unknown;
        error?: any;
    }): boolean;
    rejectForAgent(agentId: string, error: RelayError): number;
    cancel(requestId: string, reason: "timeout" | "client_cancelled" | "shutdown" | "agent_disconnected"): boolean;
}
//# sourceMappingURL=pending-requests.d.ts.map