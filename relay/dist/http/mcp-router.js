import { Router } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createAuthMiddleware } from "../auth/middleware.ts";
import { RelayError } from "../errors.ts";
export function createMcpRouter(toolRouter, authenticator, sessions) {
    const router = Router();
    const authMiddleware = createAuthMiddleware(authenticator);
    router.use(authMiddleware);
    const server = new McpServer({ name: "autosocial-relay", version: "0.1.0" }, { capabilities: { tools: {}, prompts: {}, resources: {} } });
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    });
    server.connect(transport);
    router.post("/mcp", async (req, res) => {
        const principal = req.auth;
        const sessionId = req.headers["mcp-session-id"];
        if (!sessionId) {
            const newSessionId = `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
            sessions.set(newSessionId, { sessionId: newSessionId, principal, createdAt: Date.now() });
            res.setHeader("Mcp-Session-Id", newSessionId);
        }
        else {
            const session = sessions.get(sessionId);
            if (!session || session.principal.keyId !== principal.keyId || session.principal.orgId !== principal.orgId) {
                return res.status(404).json({ error: { code: "MCP_SESSION_NOT_FOUND", message: "Session not found" } });
            }
        }
        try {
            const result = await transport.handleRequest(req, res);
            return result;
        }
        catch (e) {
            if (e instanceof RelayError) {
                return res.status(400).json({ error: e.toJSON() });
            }
            throw e;
        }
    });
    router.get("/mcp", async (req, res) => {
        const sessionId = req.headers["mcp-session-id"];
        const session = sessionId ? sessions.get(sessionId) : undefined;
        if (!session) {
            return res.status(404).json({ error: { code: "MCP_SESSION_NOT_FOUND", message: "Session not found" } });
        }
        return transport.handleRequest(req, res);
    });
    router.delete("/mcp", async (req, res) => {
        const sessionId = req.headers["mcp-session-id"];
        if (sessionId) {
            sessions.delete(sessionId);
        }
        res.status(204).send();
    });
    return router;
}
//# sourceMappingURL=mcp-router.js.map