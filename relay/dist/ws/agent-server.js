import { WebSocket } from "ws";
import { RelayError } from "../errors.ts";
import { AgentRegisterSchema, AgentHeartbeatSchema, ToolResultSchema, ToolCancelSchema, } from "../schemas.ts";
export function createWsAgentServer(wsServer, agentRegistry, pendingRequests, config) {
    wsServer.on("connection", (ws, req, principal) => {
        console.log(`Agent connected: ${principal.keyId} (${principal.orgId})`);
        let connectionId = null;
        let agentId = null;
        let registerTimeout;
        let heartbeatInterval;
        const send = (message) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            }
        };
        const close = (code, reason) => {
            ws.close(code, reason);
        };
        const cleanup = () => {
            clearTimeout(registerTimeout);
            clearInterval(heartbeatInterval);
            if (connectionId && agentId) {
                agentRegistry.remove(agentId, connectionId);
            }
            pendingRequests.rejectForAgent(agentId, new RelayError("AGENT_DISCONNECTED", "Agent disconnected", { agentId }, true));
        };
        ws.on("message", (data) => {
            try {
                const message = JSON.parse(data.toString());
                handleMessage(message);
            }
            catch (e) {
                console.warn("Invalid agent message:", e);
                close(1008, "Invalid message format");
            }
        });
        ws.on("close", () => cleanup());
        ws.on("error", (err) => {
            console.error("Agent WS error:", err);
            cleanup();
        });
        registerTimeout = setTimeout(() => {
            close(4004, "Registration timeout");
        }, config.registerTimeoutMs);
        async function handleMessage(message) {
            if (!message.type)
                return;
            if (message.type === "agent.register") {
                const parsed = AgentRegisterSchema.safeParse(message);
                if (!parsed.success) {
                    close(4005, "Invalid registration");
                    return;
                }
                if (parsed.data.orgId !== principal.orgId) {
                    close(4006, "Organization mismatch");
                    return;
                }
                const tools = new Set(parsed.data.tools);
                const accounts = parsed.data.accounts.map(a => ({
                    id: a.id,
                    name: a.name,
                    platforms: a.platforms,
                }));
                const connection = agentRegistry.register(principal, ws, {
                    agentId: parsed.data.agentId,
                    agentVersion: parsed.data.agentVersion,
                    tools: Array.from(tools),
                    accounts,
                });
                connectionId = connection.connectionId;
                agentId = connection.agentId;
                clearTimeout(registerTimeout);
                send({
                    type: "agent.registered",
                    connectionId: connection.connectionId,
                    heartbeatIntervalMs: config.heartbeatIntervalMs,
                });
                heartbeatInterval = setInterval(() => {
                    if (ws.readyState !== WebSocket.OPEN)
                        return;
                    const conn = agentRegistry.get(agentId);
                    if (!conn || conn.connectionId !== connectionId)
                        return;
                    agentRegistry.updateHeartbeat(agentId, "healthy");
                }, config.heartbeatIntervalMs);
                return;
            }
            if (!connectionId || !agentId) {
                close(4005, "Not registered");
                return;
            }
            const conn = agentRegistry.get(agentId);
            if (!conn || conn.connectionId !== connectionId) {
                close(4009, "Connection replaced");
                return;
            }
            if (message.type === "agent.heartbeat") {
                const parsed = AgentHeartbeatSchema.safeParse(message);
                if (parsed.success) {
                    agentRegistry.updateHeartbeat(agentId, parsed.data.status ?? "healthy");
                    send({ type: "agent.heartbeat_ack", receivedAt: new Date().toISOString() });
                }
                return;
            }
            if (message.type === "tool.result") {
                const parsed = ToolResultSchema.safeParse(message);
                if (parsed.success) {
                    pendingRequests.resolve(parsed.data);
                }
                return;
            }
            if (message.type === "tool.cancel") {
                const parsed = ToolCancelSchema.safeParse(message);
                if (parsed.success) {
                    pendingRequests.cancel(parsed.data.requestId, parsed.data.reason);
                }
                return;
            }
        }
    });
    setInterval(() => {
        for (const agentId of agentRegistry.getStale(config.agentStaleMs)) {
            const conn = agentRegistry.get(agentId);
            if (conn) {
                console.warn(`Agent stale: ${agentId}`);
                conn.socket.close(4008, "Heartbeat timeout");
            }
        }
    }, config.heartbeatIntervalMs);
}
//# sourceMappingURL=agent-server.js.map