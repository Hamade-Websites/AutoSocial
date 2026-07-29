export class RelayError extends Error {
    code;
    details;
    retryable;
    constructor(code, message, details, retryable = false) {
        super(message);
        this.code = code;
        this.details = details;
        this.retryable = retryable;
        this.name = "RelayError";
    }
    static fromUnknown(err) {
        if (err instanceof RelayError)
            return err;
        if (err instanceof Error)
            return new RelayError("INTERNAL_ERROR", err.message);
        return new RelayError("INTERNAL_ERROR", "Unknown error");
    }
    toHttpStatus() {
        const statusMap = {
            INVALID_ARGUMENT: 400,
            SCOPE_DENIED: 403,
            AGENT_NOT_FOUND: 404,
            AGENT_UNAVAILABLE: 503,
            AGENT_AMBIGUOUS: 409,
            AGENT_CAPABILITY_MISSING: 400,
            ACCOUNT_NOT_FOUND: 404,
            RATE_LIMITED: 429,
            TOO_MANY_INFLIGHT: 429,
            AGENT_TIMEOUT: 504,
            AGENT_DISCONNECTED: 503,
            CLIENT_CANCELLED: 400,
            PROTOCOL_ERROR: 400,
            INTERNAL_ERROR: 500,
            AUTH_REQUIRED: 401,
            AUTH_INVALID: 401,
            MCP_SESSION_NOT_FOUND: 404,
            SERVER_NOT_READY: 503,
        };
        return statusMap[this.code] ?? 500;
    }
    toMcpError() {
        return { code: this.code, message: this.message, retryable: this.retryable, details: this.details };
    }
}
export function isRelayError(err) {
    return err instanceof RelayError;
}
//# sourceMappingURL=errors.js.map