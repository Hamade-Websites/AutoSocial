import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { RelayConfig, type ApiKeyRecord } from "./config.ts";
interface RelayServer {
    app: express.Express;
    httpServer: ReturnType<typeof createServer>;
    wsServer: WebSocketServer;
    config: RelayConfig & {
        apiKeys: ApiKeyRecord[];
    };
    start(): Promise<void>;
    stop(reason: string): Promise<void>;
    isReady(): boolean;
}
declare function createRelayServer(): Promise<RelayServer>;
export { createRelayServer };
export type { RelayServer };
//# sourceMappingURL=index.d.ts.map