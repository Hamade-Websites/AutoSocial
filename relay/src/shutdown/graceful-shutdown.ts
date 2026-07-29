import { Server } from "http";
import { WebSocketServer } from "ws";
import { PendingRequestStore } from "../pending/pending-requests.ts";
import { AgentRegistry } from "../registry/agent-registry.ts";

export class GracefulShutdown {
  private shuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;

  constructor(
    private readonly httpServer: Server,
    private readonly wsServer: WebSocketServer,
    private readonly pendingRequests: PendingRequestStore,
    private readonly agentRegistry: AgentRegistry,
    private readonly gracePeriodMs: number
  ) {}

  shutdown(reason: string): Promise<void> {
    if (this.shutdownPromise) return this.shutdownPromise;

    this.shuttingDown = true;
    console.log(`Graceful shutdown initiated: ${reason}`);

    this.shutdownPromise = this.executeShutdown(reason);
    return this.shutdownPromise;
  }

  private async executeShutdown(reason: string): Promise<void> {
    this.httpServer.emit("shutdown", reason);

    for (const client of this.wsServer.clients) {
      if (client.readyState === 1) {
        client.close(4010, "Server shutting down");
      }
    }

    this.pendingRequests.close();

    const deadline = Date.now() + this.gracePeriodMs;
    while (Date.now() < deadline) {
      if (this.pendingRequests.sizeForAgent("") === 0) break;
      await new Promise(r => setTimeout(r, 100));
    }

    this.httpServer.closeAllConnections();
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }
}