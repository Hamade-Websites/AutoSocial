import { RelayError } from "../errors.ts";
export class PendingRequestStore {
    maxInflightPerAgent;
    maxInflightPerOrg;
    toolTimeoutMs;
    pending = new Map();
    perAgent = new Map();
    perOrg = new Map();
    constructor(maxInflightPerAgent, maxInflightPerOrg, toolTimeoutMs) {
        this.maxInflightPerAgent = maxInflightPerAgent;
        this.maxInflightPerOrg = maxInflightPerOrg;
        this.toolTimeoutMs = toolTimeoutMs;
    }
    create(input, agentId, orgId) {
        if ((this.perAgent.get(agentId)?.size ?? 0) >= this.maxInflightPerAgent) {
            throw new RelayError("TOO_MANY_INFLIGHT", "Agent has too many in-flight requests", { agentId }, true);
        }
        if ((this.perOrg.get(orgId)?.size ?? 0) >= this.maxInflightPerOrg) {
            throw new RelayError("TOO_MANY_INFLIGHT", "Organization has too many in-flight requests", { orgId }, true);
        }
        const timeoutId = setTimeout(() => {
            const entry = this.pending.get(input.requestId);
            if (entry) {
                this.cleanup(input.requestId);
                entry.reject(new RelayError("AGENT_TIMEOUT", "Agent did not respond in time", { requestId: input.requestId }, true));
            }
        }, this.toolTimeoutMs);
        const promise = new Promise((resolve, reject) => {
            const entry = {
                requestId: input.requestId,
                deadline: input.deadline,
                abortSignal: input.abortSignal,
                resolve,
                reject,
                timeoutId,
            };
            this.pending.set(input.requestId, entry);
            this.addToAgent(agentId, input.requestId);
            this.addToOrg(orgId, input.requestId);
            input.abortSignal.addEventListener("abort", () => {
                this.cancel(input.requestId, "client_cancelled");
            });
        });
        return promise;
    }
    addToAgent(agentId, requestId) {
        if (!this.perAgent.has(agentId))
            this.perAgent.set(agentId, new Set());
        this.perAgent.get(agentId).add(requestId);
    }
    addToOrg(orgId, requestId) {
        if (!this.perOrg.has(orgId))
            this.perOrg.set(orgId, new Set());
        this.perOrg.get(orgId).add(requestId);
    }
    cleanup(requestId) {
        const entry = this.pending.get(requestId);
        if (entry) {
            clearTimeout(entry.timeoutId);
            this.pending.delete(requestId);
        }
    }
    resolve(message) {
        const entry = this.pending.get(message.requestId);
        if (!entry)
            return false;
        this.cleanup(message.requestId);
        if (message.success) {
            entry.resolve(message.result);
        }
        else {
            entry.reject(new RelayError(message.error.code, message.error.message, message.error.details, message.error.retryable));
        }
        return true;
    }
    rejectForAgent(agentId, error) {
        const requestIds = this.perAgent.get(agentId);
        if (!requestIds)
            return 0;
        let count = 0;
        for (const requestId of requestIds) {
            const entry = this.pending.get(requestId);
            if (entry) {
                this.cleanup(requestId);
                entry.reject(error);
                count++;
            }
        }
        return count;
    }
    cancel(requestId, reason) {
        const entry = this.pending.get(requestId);
        if (!entry)
            return false;
        this.cleanup(requestId);
        entry.reject(new RelayError("CLIENT_CANCELLED", `Request cancelled: ${reason}`, { requestId, reason }, false));
        return true;
    }
}
//# sourceMappingURL=pending-requests.js.map