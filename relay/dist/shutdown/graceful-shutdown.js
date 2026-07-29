export class GracefulShutdown {
    httpServer;
    wsServer;
    pendingRequests;
    agentRegistry;
    gracePeriodMs;
    shuttingDown = false;
    shutdownPromise = null;
    constructor(httpServer, wsServer, pendingRequests, agentRegistry, gracePeriodMs) {
        this.httpServer = httpServer;
        this.wsServer = wsServer;
        this.pendingRequests = pendingRequests;
        this.agentRegistry = agentRegistry;
        this.gracePeriodMs = gracePeriodMs;
    }
    shutdown(reason) {
        if (this.shutdownPromise)
            return this.shutdownPromise;
        this.shuttingDown = true;
        console.log(`Graceful shutdown initiated: ${reason}`);
        this.shutdownPromise = this.executeShutdown(reason);
        return this.shutdownPromise;
    }
    async executeShutdown(reason) {
        this.httpServer.emit("shutdown", reason);
        for (const client of this.wsServer.clients) {
            if (client.readyState === 1) {
                client.close(4010, "Server shutting down");
            }
        }
        this.pendingRequests.close();
        const deadline = Date.now() + this.gracePeriodMs;
        while (Date.now() < deadline) {
            if (this.pendingRequests.sizeForAgent("") === 0)
                break;
            await new Promise(r => setTimeout(r, 100));
        }
        this.httpServer.closeAllConnections();
    }
    isShuttingDown() {
        return this.shuttingDown;
    }
}
//# sourceMappingURL=graceful-shutdown.js.map