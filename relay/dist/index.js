import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { loadConfig } from "./config.ts";
import { createApiKeyAuthenticator } from "./auth/api-key.ts";
import { createAuthMiddleware } from "./auth/middleware.ts";
import { AgentRegistry } from "./registry/agent-registry.ts";
import { PendingRequestStore } from "./pending/pending-requests.ts";
import { ToolRouter } from "./routing/tool-router.ts";
import { healthRouter } from "./http/health.ts";
import { createMcpRouter } from "./http/mcp-router.ts";
import { createWsAgentServer } from "./ws/agent-server.ts";
import { GracefulShutdown } from "./shutdown/graceful-shutdown.ts";
let shutdownHandler = null;
async function createRelayServer() {
    const config = loadConfig();
    const apiKeyAuthenticator = createApiKeyAuthenticator(config.apiKeys, config.apiKeyPepper);
    const authMiddleware = createAuthMiddleware(apiKeyAuthenticator);
    const app = express();
    app.set("trust proxy", config.trustProxy);
    app.use(express.json({ limit: config.maxBodyBytes }));
    app.use(authMiddleware);
    const httpServer = createServer(app);
    const wsServer = new WebSocketServer({ noServer: true });
    httpServer.on("upgrade", (req, socket, head) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            socket.destroy();
            return;
        }
        const key = authHeader.slice(7);
        const principal = apiKeyAuthenticator(key);
        if (!principal || !principal.scopes.has("agent:connect")) {
            socket.destroy();
            return;
        }
        wsServer.handleUpgrade(req, socket, head, (ws) => {
            wsServer.emit("connection", ws, req, principal);
        });
    });
    const agentRegistry = new AgentRegistry();
    const pendingRequests = new PendingRequestStore(config.maxInflightPerAgent, config.maxInflightPerOrg, config.toolTimeoutMs);
    const toolRouter = new ToolRouter(pendingRequests, agentRegistry);
    app.use("/health", healthRouter);
    app.use(createMcpRouter(toolRouter, apiKeyAuthenticator, new Map()));
    createWsAgentServer(wsServer, agentRegistry, pendingRequests, config);
    let ready = false;
    const shutdown = new GracefulShutdown(httpServer, wsServer, pendingRequests, agentRegistry, config.shutdownGraceMs);
    shutdownHandler = shutdown;
    async function start() {
        await new Promise((resolve, reject) => {
            httpServer.listen(config.port, config.host, (err) => {
                if (err)
                    reject(err);
                else {
                    ready = true;
                    console.log(`Relay server listening on ${config.host}:${config.port}`);
                    resolve();
                }
            });
        });
    }
    async function stop(reason) {
        console.log(`Shutting down: ${reason}`);
        ready = false;
        await shutdown.shutdown();
        await new Promise((resolve) => httpServer.close(() => resolve()));
    }
    return {
        app,
        httpServer,
        wsServer,
        config,
        start,
        stop,
        isReady: () => ready,
    };
}
createRelayServer().then(server => server.start()).catch(err => {
    console.error("Failed to start relay server:", err);
    process.exit(1);
});
process.on("SIGINT", () => shutdownHandler?.shutdown("SIGINT"));
process.on("SIGTERM", () => shutdownHandler?.shutdown("SIGTERM"));
export { createRelayServer };
//# sourceMappingURL=index.js.map