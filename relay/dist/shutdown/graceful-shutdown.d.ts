import { Server } from "http";
import { WebSocketServer } from "ws";
import { PendingRequestStore } from "../pending/pending-requests.ts";
import { AgentRegistry } from "../registry/agent-registry.ts";
export declare class GracefulShutdown {
    private readonly httpServer;
    private readonly wsServer;
    private readonly pendingRequests;
    private readonly agentRegistry;
    private readonly gracePeriodMs;
    private shuttingDown;
    private shutdownPromise;
    constructor(httpServer: Server, wsServer: WebSocketServer, pendingRequests: PendingRequestStore, agentRegistry: AgentRegistry, gracePeriodMs: number);
    shutdown(reason: string): Promise<void>;
    private executeShutdown;
    isShuttingDown(): boolean;
}
//# sourceMappingURL=graceful-shutdown.d.ts.map