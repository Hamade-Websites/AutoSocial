import { Router, Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createAuthMiddleware, AuthRequest } from "../auth/middleware.ts";
import { ToolRouter } from "../routing/tool-router.ts";
import type { AuthPrincipal, ToolName, ToolResult } from "../schemas.ts";
import { RelayError, RelayErrorCode } from "../errors.ts";

interface McpSession {
  sessionId: string;
  principal: AuthPrincipal;
  createdAt: number;
}

export function createMcpRouter(
  toolRouter: ToolRouter,
  authenticator: (key: string) => AuthPrincipal | null,
  sessions: Map<string, McpSession>
): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(authenticator);

  router.use(authMiddleware);

  const server = new McpServer(
    { name: "autosocial-relay", version: "0.1.0" },
    { capabilities: { tools: {}, prompts: {}, resources: {} } }
  );

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
  });

  server.connect(transport);

  router.post("/mcp", async (req: AuthRequest, res: Response) => {
    const principal = req.auth!;
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (!sessionId) {
      const newSessionId = `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessions.set(newSessionId, { sessionId: newSessionId, principal, createdAt: Date.now() });
      res.setHeader("Mcp-Session-Id", newSessionId);
    } else {
      const session = sessions.get(sessionId);
      if (!session || session.principal.keyId !== principal.keyId || session.principal.orgId !== principal.orgId) {
        return res.status(404).json({ error: { code: "MCP_SESSION_NOT_FOUND", message: "Session not found" } });
      }
    }

    try {
      const result = await transport.handleRequest(req, res);
      return result;
    } catch (e: any) {
      if (e instanceof RelayError) {
        return res.status(400).json({ error: e.toJSON() });
      }
      throw e;
    }
  });

  router.get("/mcp", async (req: AuthRequest, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string;
    const session = sessionId ? sessions.get(sessionId) : undefined;
    if (!session) {
      return res.status(404).json({ error: { code: "MCP_SESSION_NOT_FOUND", message: "Session not found" } });
    }
    return transport.handleRequest(req, res);
  });

  router.delete("/mcp", async (req: AuthRequest, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string;
    if (sessionId) {
      sessions.delete(sessionId);
    }
    res.status(204).send();
  });

  return router;
}