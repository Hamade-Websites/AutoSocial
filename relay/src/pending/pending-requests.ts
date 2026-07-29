import { RelayError, RelayErrorCode } from "../errors.ts";
import type { ToolResult } from "../schemas.ts";

export interface PendingRequestInput {
  requestId: string;
  toolName: string;
  deadline: number;
  abortSignal: AbortSignal;
}

interface PendingRequest {
  requestId: string;
  deadline: number;
  abortSignal: AbortSignal;
  resolve: (value: ToolResult) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

export class PendingRequestStore {
  private pending = new Map<string, PendingRequest>();
  private perAgent = new Map<string, Set<string>>();
  private perOrg = new Map<string, Set<string>>();

  constructor(
    private readonly maxInflightPerAgent: number,
    private readonly maxInflightPerOrg: number,
    private readonly toolTimeoutMs: number
  ) {}

  create(input: PendingRequestInput, agentId: string, orgId: string): Promise<any> {
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
      const entry: PendingRequest = {
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

  private addToAgent(agentId: string, requestId: string): void {
    if (!this.perAgent.has(agentId)) this.perAgent.set(agentId, new Set());
    this.perAgent.get(agentId)!.add(requestId);
  }

  private addToOrg(orgId: string, requestId: string): void {
    if (!this.perOrg.has(orgId)) this.perOrg.set(orgId, new Set());
    this.perOrg.get(orgId)!.add(requestId);
  }

  private cleanup(requestId: string): void {
    const entry = this.pending.get(requestId);
    if (entry) {
      clearTimeout(entry.timeoutId);
      this.pending.delete(requestId);
    }
  }

  resolve(message: { requestId: string; success: boolean; result?: unknown; error?: any }): boolean {
    const entry = this.pending.get(message.requestId);
    if (!entry) return false;
    this.cleanup(message.requestId);
    if (message.success) {
      entry.resolve(message.result);
    } else {
      entry.reject(new RelayError(message.error.code, message.error.message, message.error.details, message.error.retryable));
    }
    return true;
  }

  rejectForAgent(agentId: string, error: RelayError): number {
    const requestIds = this.perAgent.get(agentId);
    if (!requestIds) return 0;
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

  cancel(requestId: string, reason: "timeout" | "client_cancelled" | "shutdown" | "agent_disconnected"): boolean {
    const entry = this.pending.get(requestId);
    if (!entry) return false;
    this.cleanup(requestId);
    entry.reject(new RelayError("CLIENT_CANCELLED", `Request cancelled: ${reason}`, { requestId, reason }, false));
    return true;
  }
}