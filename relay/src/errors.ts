export type RelayErrorCode =
  | "INVALID_ARGUMENT"
  | "SCOPE_DENIED"
  | "AGENT_NOT_FOUND"
  | "AGENT_UNAVAILABLE"
  | "AGENT_AMBIGUOUS"
  | "AGENT_CAPABILITY_MISSING"
  | "ACCOUNT_NOT_FOUND"
  | "RATE_LIMITED"
  | "TOO_MANY_INFLIGHT"
  | "AGENT_TIMEOUT"
  | "AGENT_DISCONNECTED"
  | "CLIENT_CANCELLED"
  | "PROTOCOL_ERROR"
  | "INTERNAL_ERROR"
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "MCP_SESSION_NOT_FOUND"
  | "SERVER_NOT_READY";

export class RelayError extends Error {
  public readonly code: RelayErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly retryable: boolean;

  constructor(
    code: RelayErrorCode,
    message: string,
    details?: Record<string, unknown>,
    retryable: boolean = false
  ) {
    super(message);
    this.name = "RelayError";
    this.code = code;
    this.details = details;
    this.retryable = retryable;
  }

  static fromUnknown(err: unknown): RelayError {
    if (err instanceof RelayError) return err;
    if (err instanceof Error) return new RelayError("INTERNAL_ERROR", err.message);
    return new RelayError("INTERNAL_ERROR", "Unknown error");
  }

  toHttpStatus(): number {
    const statusMap: Record<RelayErrorCode, number> = {
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

  toMcpError(): { code: RelayErrorCode; message: string; retryable: boolean; details?: Record<string, unknown> } {
    return { code: this.code, message: this.message, retryable: this.retryable, details: this.details };
  }
}

export function isRelayError(err: unknown): err is RelayError {
  return err instanceof RelayError;
}