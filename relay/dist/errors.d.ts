export type RelayErrorCode = "INVALID_ARGUMENT" | "SCOPE_DENIED" | "AGENT_NOT_FOUND" | "AGENT_UNAVAILABLE" | "AGENT_AMBIGUOUS" | "AGENT_CAPABILITY_MISSING" | "ACCOUNT_NOT_FOUND" | "RATE_LIMITED" | "TOO_MANY_INFLIGHT" | "AGENT_TIMEOUT" | "AGENT_DISCONNECTED" | "CLIENT_CANCELLED" | "PROTOCOL_ERROR" | "INTERNAL_ERROR" | "AUTH_REQUIRED" | "AUTH_INVALID" | "MCP_SESSION_NOT_FOUND" | "SERVER_NOT_READY";
export declare class RelayError extends Error {
    readonly code: RelayErrorCode;
    readonly details?: Record<string, unknown> | undefined;
    readonly retryable: boolean;
    constructor(code: RelayErrorCode, message: string, details?: Record<string, unknown> | undefined, retryable?: boolean);
    static fromUnknown(err: unknown): RelayError;
    toHttpStatus(): number;
    toMcpError(): {
        code: RelayErrorCode;
        message: string;
        retryable: boolean;
        details?: Record<string, unknown>;
    };
}
export declare function isRelayError(err: unknown): err is RelayError;
//# sourceMappingURL=errors.d.ts.map