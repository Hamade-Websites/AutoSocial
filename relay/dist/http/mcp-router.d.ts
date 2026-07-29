import { Router } from "express";
import { ToolRouter } from "../routing/tool-router.ts";
import type { AuthPrincipal } from "../schemas.ts";
interface McpSession {
    sessionId: string;
    principal: AuthPrincipal;
    createdAt: number;
}
export declare function createMcpRouter(toolRouter: ToolRouter, authenticator: (key: string) => AuthPrincipal | null, sessions: Map<string, McpSession>): Router;
export {};
//# sourceMappingURL=mcp-router.d.ts.map