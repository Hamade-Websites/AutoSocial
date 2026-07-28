# 1. ARCHITECTURE OVERVIEW

## 1.1 Goal

Add a standalone MCP relay service that:

- Accepts authenticated MCP clients over Streamable HTTP.
- Accepts authenticated local AutoSocial agents over WebSocket.
- Routes MCP tool calls to the correct connected local agent.
- Correlates asynchronous agent responses with the originating MCP request.
- Enforces organization isolation, API-key scopes, timeouts, payload limits, and concurrency limits.
- Never imports or runs Playwright, Chromium, uploaders, video processing, local profiles, or AutoSocial browser automation.

The relay transports JSON only. Videos, captions stored in sidecar files, browser profiles, cookies, and social-platform credentials remain on the local agent machine.

## 1.2 Codebase Constraints

The current repository:

- Is a CommonJS Node.js application targeting Node.js 18+.
- Runs an Express 5 dashboard from `src/dashboard-server.js`.
- Contains Playwright and all social-platform automation in the root package.
- Stores accounts in `accounts-state.json`.
- Stores per-account queues under `queue/<accountId>/<platform>/`.
- Exposes local operations through `account-manager.js`, `daemon-registry.js`, and the platform daemon controllers.
- Has no stable agent protocol, MCP SDK, WebSocket server, Zod validation, database, or distributed session store.
- Uses the built-in `node:test` runner.

The relay must therefore be an isolated package under `relay/`, with its own manifest, lockfile, TypeScript configuration, dependencies, Docker build context, and tests. Its production image must not install the root package and must not contain Playwright.

## 1.3 Component Topology

```text
MCP client
  |
  | HTTPS, Streamable HTTP, Authorization: Bearer <API key>
  v
relay/src/http/mcp-router.ts
  |
  | authenticated organization + scope context
  v
relay/src/routing/tool-router.ts
  |
  +--> relay-local tools: list_agents
  |
  +--> agent registry lookup by organization, capability, account, agent ID
          |
          | WSS /v1/agents/connect
          v
      Local AutoSocial agent
          |
          +--> account-manager.js
          +--> daemon-registry.js
          +--> platform daemon controllers
          +--> Playwright uploaders, only on the local machine
```

## 1.4 Process Boundaries

The relay process owns only:

- API-key verification.
- MCP sessions.
- Connected-agent metadata.
- Pending request correlation.
- Routing and authorization.
- Heartbeat and connection health.
- Rate/concurrency limiting.
- Structured operational logs.

The relay must not:

- Depend on the root `autosocial-studio` package.
- Import anything from `../src`.
- Accept video or arbitrary file uploads.
- Accept local file paths as tool arguments.
- Read or write `.profiles/`, `queue/`, `.scheduler-state/`, `.env`, or `accounts-state.json`.
- Proxy browser pages, screenshots, cookies, or platform credentials.
- Execute shell commands or spawn child processes.

## 1.5 Runtime Modules

### Configuration

```ts
function loadConfig(env: NodeJS.ProcessEnv): RelayConfig;
```

Parse and validate all environment variables once during startup. Invalid configuration terminates startup with a non-zero exit code.

### API-Key Authentication

```ts
interface ApiKeyAuthenticator {
  authenticate(rawKey: string): AuthPrincipal | null;
}

function createApiKeyAuthenticator(
  records: ApiKeyRecord[],
  pepper: string
): ApiKeyAuthenticator;

function hashApiKeySecret(secret: string, pepper: string): Buffer;
```

API keys use:

```text
as_live_<keyId>_<secret>
as_test_<keyId>_<secret>
```

Only keyed HMAC-SHA-256 hashes are configured. Plaintext secrets must never be logged or persisted.

### Agent Registry

```ts
interface AgentRegistry {
  register(connection: AgentConnection): void;
  updateHeartbeat(agentId: string, heartbeat: AgentHeartbeat): void;
  remove(agentId: string, connectionId: string): void;
  get(agentId: string): AgentConnection | undefined;
  listForOrg(orgId: string): AgentSummary[];
  selectAgent(criteria: AgentSelectionCriteria): AgentConnection;
  markDraining(agentId: string): void;
}
```

Registry state is in memory for the first release. One agent ID may have only one active connection. A newly authenticated connection replaces the old connection only after successful registration; the old socket closes with code `4009`.

### Pending Request Store

```ts
interface PendingRequestStore {
  create(input: PendingRequestInput): Promise<AgentToolResult>;
  resolve(message: AgentToolResult): boolean;
  rejectForAgent(agentId: string, error: RelayError): number;
  cancel(requestId: string, reason: string): boolean;
  sizeForAgent(agentId: string): number;
  close(): void;
}
```

Each request has one timer, one abort listener, and one terminal transition. Entries must be removed on success, error, timeout, MCP cancellation, socket close, and server shutdown.

### Tool Router

```ts
async function routeToolCall(
  principal: AuthPrincipal,
  toolName: ToolName,
  input: unknown,
  context: ToolCallContext
): Promise<McpToolResult>;
```

Routing order:

1. Validate the MCP tool input with Zod.
2. Verify the required API-key scope.
3. Execute relay-local tools directly.
4. Resolve the target agent using the authenticated `orgId`; never trust an organization supplied by the client.
5. Verify the agent advertises the requested tool and account.
6. Enforce per-agent and per-organization in-flight limits.
7. Send `tool.call`.
8. Await `tool.result`, timeout, cancellation, or disconnect.
9. Convert the outcome to an MCP tool result.

## 1.6 Agent Selection

Agent-bound tools accept optional `agent_id` and, where applicable, `account_id`. Selection rules:

1. Filter to agents in the authenticated organization.
2. Exclude agents that are degraded, stale, or draining.
3. If the caller supplied `agent_id`, match exactly.
4. Otherwise filter to agents that advertise the requested tool.
5. If `account_id` is supplied, filter to agents that list that account.
6. If multiple agents remain, return `AGENT_AMBIGUOUS`.
7. If exactly one agent remains, route to it.
8. If none remain, return `AGENT_UNAVAILABLE`.

# 2. FILE CHANGES

## 2.1 New Files

```
relay/
├── package.json
├── tsconfig.json
├── .gitignore
├── Dockerfile
├── .dockerignore
├── jest.config.js
├── src/
│   ├── index.ts
│   ├── config.ts
│   ├── config.test.ts
│   ├── schemas.ts
│   ├── schemas.test.ts
│   ├── errors.ts
│   ├── errors.test.ts
│   ├── auth/
│   │   ├── api-key.ts
│   │   ├── api-key.test.ts
│   │   ├── middleware.ts
│   │   └── middleware.test.ts
│   ├── registry/
│   │   ├── agent-registry.ts
│   │   ├── agent-registry.test.ts
│   │   ├── agent-selection.ts
│   │   └── agent-selection.test.ts
│   ├── pending/
│   │   ├── pending-requests.ts
│   │   └── pending-requests.test.ts
│   ├── routing/
│   │   ├── tool-router.ts
│   │   ├── tool-router.test.ts
│   │   ├── mcp-tools.ts
│   │   └── mcp-tools.test.ts
│   ├── http/
│   │   ├── mcp-router.ts
│   │   ├── mcp-router.test.ts
│   │   ├── health.ts
│   │   └── health.test.ts
│   ├── ws/
│   │   ├── agent-server.ts
│   │   ├── agent-server.test.ts
│   │   ├── message-handler.ts
│   │   └── message-handler.test.ts
│   ├── shutdown/
│   │   ├── graceful-shutdown.ts
│   │   └── graceful-shutdown.test.ts
│   ├── no-browser.test.ts
│   └── integration/
│       ├── agent-websocket.integration.test.ts
│       ├── routing.integration.test.ts
│       ├── mcp.integration.test.ts
│       └── shutdown.integration.test.ts
```

## 2.2 Modified Files

None. The relay is an isolated package. No changes to the root `autosocial-studio` package are required for the relay itself.

# 3. DATA MODELS & INTERFACES

## 3.1 Configuration (Zod)

```ts
const PlatformSchema = z.enum(["tiktok", "instagram", "youtube"]);

const SchedulePlanSchema = z.union([
  z.object({ type: z.literal("cron"), expression: z.string().min(1).max(200) }),
  z.object({ type: z.literal("daily-times"), times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).max(24) }),
]).strict();

const RelayConfigSchema = z.object({
  port: z.number().int().positive().default(8080),
  host: z.string().default("0.0.0.0"),
  pepper: z.string().min(32),
  apiKeysJson: z.string().min(2),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  staleTimeoutMs: z.number().int().positive().default(120_000),
  registrationTimeoutMs: z.number().int().positive().default(10_000),
  maxWsMessageBytes: z.number().int().positive().default(1_048_576),
  maxHttpBodyBytes: z.number().int().positive().default(1_048_576),
  toolTimeoutMs: z.number().int().positive().default(120_000),
  maxInFlightPerAgent: z.number().int().positive().default(5),
  maxInFlightPerOrg: z.number().int().positive().default(20),
  rateLimitWindowMs: z.number().int().positive().default(60_000),
  rateLimitMaxRequests: z.number().int().positive().default(120),
  shutdownGraceMs: z.number().int().positive().default(30_000),
  relayPublicUrl: z.string().url().optional(),
}).strict();
```

## 3.2 API Key Records (configured via JSON)

```ts
const ApiKeyRecordSchema = z.object({
  keyId: z.string().regex(/^[a-z0-9-]{1,64}$/),
  hash: z.string().min(1),
  orgId: z.string().min(1).max(80),
  scopes: z.array(z.enum(["mcp:read", "mcp:write", "agent:connect"])).min(1),
  enabled: z.boolean().default(true),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  environment: z.enum(["test", "live"]).default("live"),
}).strict();
```

## 3.3 Auth Principal

```ts
interface AuthPrincipal {
  orgId: string;
  scopes: Set<string>;
  keyId: string;
  environment: "test" | "live";
}
```

## 3.4 Agent Connection

```ts
interface AgentConnection {
  connectionId: string;
  agentId: string;
  orgId: string;
  agentVersion: string;
  tools: string[];
  accounts: AgentAccount[];
  status: "healthy" | "degraded" | "draining";
  registeredAt: number;
  lastHeartbeatAt: number;
  socket: WebSocket;
}
```

## 3.5 Agent Account

```ts
interface AgentAccount {
  id: string;
  name: string;
  platforms: Platform[];
}
```

## 3.6 Agent Selection Criteria

```ts
interface AgentSelectionCriteria {
  orgId: string;
  tool: string;
  accountId?: string;
  agentId?: string;
}
```

## 3.7 Pending Request

```ts
interface PendingRequestInput {
  requestId: string;
  principal: AuthPrincipal;
  toolName: string;
  input: unknown;
  agent: AgentConnection;
  deadline: number;
  abortSignal: AbortSignal;
}

type AgentToolResult = {
  requestId: string;
  success: true;
  result: unknown;
} | {
  requestId: string;
  success: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
};
```

## 3.8 Protocol Messages

### Agent → Relay: `agent.register`

```ts
const AgentRegisterSchema = z.object({
  type: z.literal("agent.register"),
  agentId: z.string().min(1).max(80),
  agentVersion: z.string().min(1).max(40),
  tools: z.array(z.string()).min(1),
  accounts: z.array(z.object({
    id: z.string().min(1).max(80),
    name: z.string().min(1).max(120),
    platforms: z.array(PlatformSchema).min(1),
  })).min(1),
}).strict();
```

### Relay → Agent: `agent.registered`

```ts
const AgentRegisteredSchema = z.object({
  type: z.literal("agent.registered"),
  connectionId: z.string(),
  heartbeatIntervalMs: z.number().int().positive(),
}).strict();
```

### Agent → Relay: `agent.heartbeat`

```ts
const AgentHeartbeatSchema = z.object({
  type: z.literal("agent.heartbeat"),
  status: z.enum(["healthy", "degraded"]).optional(),
}).strict();
```

### Relay → Agent: `tool.call`

```ts
const ToolCallSchema = z.object({
  type: z.literal("tool.call"),
  requestId: z.string(),
  tool: z.string(),
  input: z.unknown(),
}).strict();
```

### Agent → Relay: `tool.result`

```ts
const ToolResultSchema = z.object({
  type: z.literal("tool.result"),
  requestId: z.string(),
  success: z.boolean(),
  result: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }).optional(),
}).strict();
```

### Relay → Agent: `tool.cancel`

```ts
const ToolCancelSchema = z.object({
  type: z.literal("tool.cancel"),
  requestId: z.string(),
  reason: z.enum(["timeout", "client_cancelled", "shutdown", "agent_disconnected"]),
}).strict();
```

# 4. API CONTRACTS

## 4.1 HTTP: Streamable HTTP MCP Endpoint

```
POST /mcp
```

- Accepts `application/json` and `text/event-stream`.
- Requires `Authorization: Bearer <API key>`.
- Rejects keys without `mcp:read` or `mcp:write` as appropriate.
- Implements the MCP Streamable HTTP transport per the MCP TypeScript SDK.

### MCP Methods Supported

- `initialize` / `initialized`
- `tools/list`
- `tools/call`
- `prompts/list` (returns empty)
- `resources/list` (returns empty)
- Session deletion on `DELETE /mcp` (optional)

### Response Headers

- `Mcp-Session-Id`: required for session affinity.
- `Retry-After`: on `429` rate limit.

## 4.2 WebSocket: Agent Endpoint

```
GET /v1/agents/connect
Upgrade: websocket
Sec-WebSocket-Protocol: mcp.agent.v1
Authorization: Bearer <agent API key>
```

- API key must include scope `agent:connect`.
- Protocol negotiation required.
- Message framing: JSON text frames only.
- Max message size: configured limit.

## 4.3 Health Endpoints

```
GET /health/live    → 200 { "status": "live" }
GET /health/ready   → 200 { "status": "ready" } or 503 { "status": "not_ready" }
```

Readiness is `503` during shutdown grace and when no healthy agents are connected for a test organization.

## 4.4 Error Codes

### HTTP Error Codes

| Code | HTTP Status |
|------|-------------|
| `INVALID_REQUEST` | 400 |
| `AUTH_REQUIRED` | 401 |
| `AUTH_INVALID` | 401 |
| `SCOPE_DENIED` | 403 |
| `MCP_SESSION_NOT_FOUND` | 404 |
| `UPGRADE_REQUIRED` | 426 |
| `PAYLOAD_TOO_LARGE` | 413 |
| `RATE_LIMITED` | 429 |
| `SERVER_NOT_READY` | 503 |
| `INTERNAL_ERROR` | 500 |

### WebSocket Close Codes

| Code | Meaning |
|------|---------|
| `1000` | Normal shutdown |
| `1008` | Generic policy/schema violation |
| `1009` | Message exceeds configured maximum |
| `4001` | Authentication failed |
| `4003` | Missing `agent:connect` scope |
| `4004` | Registration timeout |
| `4005` | Invalid registration |
| `4006` | Organization mismatch |
| `4008` | Heartbeat timeout |
| `4009` | Replaced by a newer connection |
| `4010` | Server shutting down |

### Tool Error Codes (MCP `isError: true`)

- `INVALID_ARGUMENT`
- `SCOPE_DENIED`
- `AGENT_NOT_FOUND`
- `AGENT_UNAVAILABLE`
- `AGENT_AMBIGUOUS`
- `AGENT_CAPABILITY_MISSING`
- `ACCOUNT_NOT_FOUND`
- `RATE_LIMITED`
- `TOO_MANY_INFLIGHT`
- `AGENT_TIMEOUT`
- `AGENT_DISCONNECTED`
- `CLIENT_CANCELLED`
- `PROTOCOL_ERROR`
- `INTERNAL_ERROR`

## 4.5 MCP Tool Definitions

All property names exposed to MCP clients use snake case. Organization IDs are never accepted as tool arguments.

### `list_agents`

Description: List connected local AutoSocial agents available to the authenticated organization.

Required scope: `mcp:read`.

Input:

```ts
z.object({
  include_degraded: z.boolean().default(false),
}).strict()
```

Result:

```json
{
  "agents": [
    {
      "agent_id": "agt_home",
      "status": "healthy",
      "agent_version": "0.1.0",
      "tools": ["list_accounts", "get_queue_status"],
      "accounts": [
        {
          "id": "default",
          "name": "Default",
          "platforms": ["tiktok", "instagram", "youtube"]
        }
      ],
      "last_heartbeat_at": "2026-07-27T20:00:00.000Z"
    }
  ]
}
```

### `list_accounts`

Description: List accounts managed by a local agent.

Required scope: `mcp:read`.

Input:

```ts
z.object({
  agent_id: z.string().optional(),
}).strict()
```

Agent mapping:

```ts
getAllAccounts(): Promise<Array<{ id: string; name: string }>>;
```

### `get_queue_status`

Description: Return scheduler and queue status for one account and optionally one platform.

Required scope: `mcp:read`.

Input:

```ts
z.object({
  account_id: z.string().min(1).max(80),
  platform: PlatformSchema.optional(),
  agent_id: z.string().optional(),
}).strict()
```

Agent mapping:

```ts
getDaemons(accountId: string): Promise<PlatformDaemons>;
daemon.getStatus(): Promise<DaemonStatus>;
```

The local agent must remove absolute local paths, screenshots, and sensitive log details before returning results.

### `post_now`

Description: Ask the local agent to run the next queued post for an account and platform.

Required scope: `mcp:write`.

Input:

```ts
z.object({
  account_id: z.string().min(1).max(80),
  platform: PlatformSchema,
  agent_id: z.string().optional(),
}).strict()
```

Agent mapping:

```ts
const daemons = await getDaemons(accountId);
await daemons[platform].runOnce("mcp-relay");
```

`QUEUE_EMPTY` is a valid tool error, not a relay transport failure. `POST_IN_PROGRESS` is retryable.

### `scheduler_control`

Description: Start or stop a platform scheduler.

Required scope: `mcp:write`.

Input:

```ts
z.object({
  account_id: z.string().min(1).max(80),
  platform: PlatformSchema,
  action: z.enum(["start", "stop"]),
  agent_id: z.string().optional(),
}).strict()
```

Agent mapping:

```ts
daemon.start(): SchedulerStartResult;
daemon.stop(): SchedulerStopResult;
```

### `set_schedule`

Description: Set a cron schedule or daily time plan.

Required scope: `mcp:write`.

Input:

```ts
z.object({
  account_id: z.string().min(1).max(80),
  platform: PlatformSchema,
  schedule: SchedulePlanSchema,
  agent_id: z.string().optional(),
}).strict()
```

Agent mapping:

```ts
daemon.setSchedule(expression: string): Promise<ScheduleResult>;
daemon.setDailyTimes(times: string[]): Promise<ScheduleResult>;
```

Cron validation remains authoritative on the local agent. Relay validation limits only shape and size.

### `set_instant_post`

Description: Enable or disable the local queue watcher for a platform.

Required scope: `mcp:write`.

Input:

```ts
z.object({
  account_id: z.string().min(1).max(80),
  platform: PlatformSchema,
  enabled: z.boolean(),
  agent_id: z.string().optional(),
}).strict()
```

Agent mapping:

```ts
daemon.setInstantPost(enabled: boolean): Promise<InstantPostResult>;
```

## 4.6 Tool Error Mapping

Agent errors become MCP results with `isError: true` and JSON text content:

```json
{
  "code": "AGENT_UNAVAILABLE",
  "message": "No healthy agent can execute this tool.",
  "retryable": true,
  "request_id": "req_..."
}
```

Relay tool error codes:

- `INVALID_ARGUMENT`
- `SCOPE_DENIED`
- `AGENT_NOT_FOUND`
- `AGENT_UNAVAILABLE`
- `AGENT_AMBIGUOUS`
- `AGENT_CAPABILITY_MISSING`
- `ACCOUNT_NOT_FOUND`
- `RATE_LIMITED`
- `TOO_MANY_INFLIGHT`
- `AGENT_TIMEOUT`
- `AGENT_DISCONNECTED`
- `CLIENT_CANCELLED`
- `PROTOCOL_ERROR`
- `INTERNAL_ERROR`

The relay must not return stack traces, configured API-key records, internal socket details, or another organization's agent identifiers.

# 5. TEST STRATEGY

Use TDD for every module: commit failing tests first, then the smallest implementation that passes them. Unit tests use `node:test`; integration tests start the server on an ephemeral port and use real HTTP and WebSocket clients.

## 5.1 Test Order

1. `config.test.ts`
2. `schemas.test.ts`
3. `api-key.test.ts`
4. `auth-middleware.test.ts`
5. `agent-registry.test.ts`
6. `agent-selection.test.ts`
7. `pending-requests.test.ts`
8. `agent-websocket.integration.test.ts`
9. `routing.integration.test.ts`
10. `mcp.integration.test.ts`
11. `shutdown.integration.test.ts`
12. `no-browser-boundary.test.ts`
13. Production implementation and documentation.

## 5.2 Required Unit Cases

### Configuration

- Applies every documented default.
- Rejects missing key pepper and API-key JSON.
- Rejects plaintext API-key records.
- Rejects duplicate `keyId` values.
- Rejects stale timeout less than two heartbeat intervals.
- Rejects production `RELAY_PUBLIC_URL` using HTTP.
- Does not include secret values in validation errors.

### API keys

- Accepts a valid enabled, unexpired key.
- Rejects malformed key prefixes.
- Rejects unknown key IDs and incorrect secrets identically.
- Rejects disabled and expired keys.
- Uses constant-time hash comparison.
- Derives organization and scopes from the record.
- Never logs the raw key.
- Separates `as_test_` and `as_live_` keys by environment.

### Schemas

- Accepts every valid protocol message.
- Rejects unknown fields due to `.strict()`.
- Rejects binary or oversized WebSocket messages.
- Rejects success without `result`.
- Rejects failure without `error`.
- Rejects invalid platforms, account IDs, daily times, and tool names.
- Rejects organization fields in MCP tool input.

### Registry and selection

- Registers and removes an agent.
- Prevents cross-organization lookup.
- Replaces a duplicate agent connection safely.
- Selects by organization, capability, account, and explicit agent.
- Excludes degraded, stale, and draining agents.
- Returns `AGENT_AMBIGUOUS` when multiple agents match.
- Does not leak candidate IDs from another organization.

### Pending requests

- Resolves the correct request under out-of-order results.
- Ignores duplicate and unknown results.
- Times out exactly once.
- Sends cancellation after timeout.
- Rejects all requests when an agent disconnects.
- Removes abort listeners and timers on every terminal path.
- Enforces per-agent and per-organization limits.

## 5.3 Required Integration Cases

### WebSocket

- Rejects upgrade without authentication.
- Rejects a client API key without `agent:connect`.
- Rejects API keys in query parameters.
- Closes agents that fail to register on time.
- Rejects a registration organization mismatch.
- Completes registration and heartbeat acknowledgement.
- Disconnects a stale agent.
- Replaces an existing connection with the same agent ID.
- Survives malformed messages without crashing the process.

### MCP

- Completes `initialize`, `tools/list`, `tools/call`, and session deletion.
- Lists only tools allowed by the API-key scopes.
- Rejects reuse of an MCP session by a different key or organization.
- Routes a tool call to a fake local agent and returns its result.
- Routes two simultaneous calls and correlates reversed responses.
- Returns `AGENT_UNAVAILABLE` when no agent is connected.
- Returns `AGENT_AMBIGUOUS` for nondeterministic selection.
- Propagates MCP cancellation to `tool.cancel`.
- Converts agent error results to MCP `isError: true`.
- Returns a timeout without leaving a pending entry.
- Enforces rate limits with `Retry-After`.
- Rejects request bodies over the configured limit.

### Tenant isolation

Create two organizations, two MCP keys, and two agents. Verify that:

- Each organization lists only its own agents.
- An explicit foreign `agent_id` is not usable.
- A foreign `account_id` cannot influence agent selection.
- A foreign agent result cannot resolve another organization's pending request.
- MCP sessions cannot be transferred between organizations.

### Graceful shutdown

- Readiness changes to `503`.
- New MCP calls are rejected.
- Connected agents receive close code `4010`.
- Pending calls receive `tool.cancel`.
- The process exits after pending work drains or the grace deadline expires.

### No-browser boundary

- `relay/package.json` contains no `playwright`, browser, FFmpeg, upload, or video-processing dependency.
- No relay source imports from the repository root `src/`.
- The built Docker image contains no `.profiles`, `queue`, video files, root `node_modules`, or Chromium binaries.
- Static source scanning rejects `child_process`, uploader imports, and Playwright imports in `relay/src`.

## 5.4 Completion Gates

Before merge:

```bash
npm --prefix relay run check
npm --prefix relay run check:no-browser
npm run check
docker build -t autosocial-relay-test ./relay
```

All tests must pass without a real browser, real social account, real video, or external network access.

# 6. MIGRATION STEPS

1. Create the isolated `relay/` package and establish the no-browser dependency test before adding runtime code.

2. Add configuration and API-key generation tooling. Generate separate test keys for MCP clients and agents with least-privilege scopes.

3. Implement schemas, errors, authentication, registry, agent selection, pending request correlation, and limits in TDD order.

4. Add the authenticated WebSocket endpoint and verify registration, heartbeat, result correlation, cancellation, replacement, and disconnect behavior with the fake agent.

5. Add the MCP Streamable HTTP endpoint and the six initial tools.

6. Add Docker packaging and verify that only the relay package is installed in the image. Do not deploy the root AutoSocial package as part of the relay image.

7. Implement a local agent in a separate follow-up project using the WebSocket contract. That agent may import the existing CommonJS modules:
   - `account-manager.js`
   - `daemon-registry.js`
   - platform daemon controllers

   Browser automation remains in that local process.

8. Start with `as_test_` keys and a local relay URL. Run a complete fake-agent round trip before connecting an actual AutoSocial agent.

9. Connect one non-production local AutoSocial account. Validate `list_accounts` and `get_queue_status` before enabling `mcp:write`.

10. Enable write tools incrementally:
    - `scheduler_control`
    - `set_schedule`
    - `set_instant_post`
    - `post_now`

11. Deploy a single relay replica behind TLS. The initial in-memory MCP sessions, registry, rate limits, and pending calls require connection affinity and prohibit multi-replica deployment.

12. Rotate test keys to production keys. Store plaintext keys only in the MCP client and local agent secret stores; configure only hashes in the relay.

13. Add operational alerts for authentication failures, stale agents, timeouts, protocol violations, rate limiting, and unexpected process exits.

14. Before horizontal scaling, replace in-memory session/registry coordination with a shared design such as Redis plus pub/sub, or introduce deterministic organization-to-instance routing. This is a separate milestone and must not be implied by adding replicas.

# 7. RISK ASSESSMENT

| Risk | Severity | Mitigation |
|---|---|---|
| API-key theft permits remote write actions | Critical | TLS, HMAC-hashed configured secrets, least-privilege scopes, expiration, rotation, log redaction, no query-string keys |
| Cross-organization routing | Critical | Bind `orgId` to authenticated key, never accept it in tool input, organization-aware registry and pending requests, isolation integration tests |
| Relay accidentally includes browser automation | Critical | Independent package and Docker context, dependency/source boundary tests, no imports from root `src/` |
| Tool call executes against the wrong local account | High | Require `account_id`, capability/account advertisement, deterministic agent selection, ambiguity error, local agent revalidation |
| Duplicate `post_now` after retry or disconnect | High | Do not automatically retry write tools; return request ID and unknown-outcome semantics after disconnect; future agent-side idempotency support |
| Agent result arrives after timeout | High | Remove pending entry atomically, ignore late result, emit structured warning, never attach it to a reused request ID |
| Malicious or compromised agent sends arbitrary payloads | High | Strict Zod schemas, message size limits, no binary frames, output size limits, safe error normalization |
| In-memory state is lost on restart | High | Document calls as non-durable, fail pending requests during shutdown, no automatic write retry, single-replica initial deployment |
| Multiple relay replicas cannot find the connected agent | High | Single replica initially; require shared routing/session architecture before scaling |
| Slow or hung local automation exhausts relay capacity | High | Deadlines, cancellation, per-agent/org in-flight limits, rate limits, stale-agent detection |
| MCP protocol or SDK changes break clients | Medium | Pin SDK and protocol versions, expose only tested capabilities, add client compatibility tests before upgrades |
| Existing controller results expose local paths or sensitive logs | Medium | Local agent must map results to explicit safe schemas; relay rejects oversized/unstructured sensitive fields where defined |
| API keys in environment configuration are difficult to rotate | Medium | Use key IDs, allow overlapping old/new hashes, support disable/expiry, document staged rotation |
| Health endpoint leaks tenant metadata | Low | Return only process readiness/liveness, never counts or identifiers |
| Large account lists increase memory or message size | Low | Cap accounts per registration, tool input/output size, WebSocket frame size, and HTTP body size |
| Relay becomes a file-transfer channel | Critical | No upload routes, no file/path tool arguments, JSON-only frames, strict body limits, explicit boundary tests |