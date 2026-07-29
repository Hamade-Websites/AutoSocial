# Hosted MCP Server Plan for AutoSocial Studio (Corrected)

## Architecture: Local-First with Hosted Relay

```
┌─────────────────┐     HTTPS + MCP Protocol      ┌──────────────────────┐
│  AI Assistant   │ ◄─────────────────────────────► │  Hosted MCP Relay    │
│  (Claude, etc.) │                                 │  (Auth + Routing)    │
└─────────────────┘                                 └──────────┬───────────┘
                                                                 │
                        WebSocket Tunnel (outbound from local)    │
                        ┌────────────────────────────────────────┘
                        ▼
            ┌─────────────────────────┐
            │  Local AutoSocial Agent │  ← Runs on USER'S machine
            │  (npx @autosocial/agent)│     - Playwright + Chromium
            └───────────┬─────────────┘     - Browser profiles (local)
                        │                   - Queues (local)
        ┌───────────────┼───────────────┐   - Videos (local)
        ▼               ▼               ▼
   ┌─────────┐    ┌───────────┐   ┌──────────┐
   │ TikTok  │    │ Instagram │   │ YouTube  │
   │ Profile │    │ Profile   │   │ Profile  │
   └─────────┘    └───────────┘   └──────────┘
```

**Key Principle**: Hosted MCP never sees credentials, videos, or browser state. It only routes JSON-RPC between AI assistant and local agent.

---

## Phase 1: Hosted MCP Relay (Week 1-2)

### 1.1 Minimal Relay Server

```
autosocial-mcp-relay/
├── package.json
├── src/
│   ├── index.ts              # Entry point
│   ├── relay/
│   │   ├── server.ts         # Express + WebSocket server
│   │   ├── registry.ts       # Connected agent registry
│   │   ├── router.ts         # Request routing to agents
│   │   └── auth.ts           # API key validation (simple)
│   └── config.ts
├── Dockerfile
└── fly.toml                  # Deploy to Fly.io
```

### 1.2 MCP Relay Responsibilities

| Responsibility | Details |
|----------------|---------|
| **Auth** | Validate API keys from AI assistants (Claude Desktop, Cursor) |
| **Agent Registry** | Track connected local agents (heartbeat, capabilities) |
| **Request Routing** | Forward tool calls to correct agent by `accountId`/`orgId` |
| **Response Proxy** | Stream results back to AI assistant |
| **No Browser** | Zero Playwright, zero Chromium, zero video handling |

### 1.3 Protocol: MCP over WebSocket

```typescript
// Agent → Relay: Register
{ type: "REGISTER", agentId: "agt_xxx", orgId: "org_xxx", capabilities: ["tiktok", "instagram", "youtube", "queue", "scheduler", "uniquifier"] }

// Relay → Agent: Tool Call
{ type: "TOOL_CALL", requestId: "req_xxx", tool: "post_now", params: { accountId: "acc_xxx", platform: "tiktok" } }

// Agent → Relay: Tool Result
{ type: "TOOL_RESULT", requestId: "req_xxx", result: { ok: true, ... } }

// Agent → Relay: Heartbeat (every 30s)
{ type: "HEARTBEAT", agentId: "agt_xxx", status: "healthy", queueDepth: 5 }
```

---

## Phase 2: Local Agent Package (Week 2-3)

### 2.1 Package: `@autosocial/agent`

```bash
npx @autosocial/agent start --api-key=ak_xxx --org=my-org
```

### 2.2 Agent Responsibilities

| Responsibility | Implementation |
|----------------|----------------|
| **Connect to Relay** | WebSocket to `wss://mcp.autosocial.studio/agent` |
| **Run AutoSocial** | Spawn existing `dashboard-server.js` as child process OR import modules directly |
| **Execute Tools** | Route MCP tool calls to existing AutoSocial services |
| **Manage Profiles** | `.profiles/` stays local, encrypted at rest |
| **Health Reporting** | Memory, CPU, queue depth, browser status |

### 2.3 Tool Mapping (MCP → AutoSocial)

| MCP Tool | AutoSocial Module |
|----------|-------------------|
| `list_accounts` | `account-manager.getAllAccounts()` |
| `get_queue_status` | `daemon-registry.getAllStatus()` |
| `post_now` | `tiktok/instagram/youtube-daemon-controller.runOnce()` |
| `start_login` | `tiktok/instagram/youtube-uploader.startLoginSession()` |
| `get_login_status` | `...getLoginSessionStatus()` |
| `set_schedule` | `daemon.setSchedule(expression)` |
| `add_to_queue` | Write to `queue/<account>/<platform>/pending/` |
| `uniquify_video` | `video-uniquifier.uniquifyVideo()` |

### 2.4 Encryption for Browser Profiles (Critical)

```typescript
// agent/src/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";
const KEY_FILE = path.join(homedir(), ".autosocial", "profile-key");

function getOrCreateKey(): Buffer {
  // Derive from machine-specific + user password, or use OS keychain
  // Store encrypted key in OS keychain (keytar) + local file as fallback
}

function encryptProfile(profileDir: string, destDir: string) {
  // Tar + encrypt each profile directory
  // Only decrypt in-memory when Playwright needs it
}

function decryptProfile(encryptedDir: string, destDir: string) {
  // Decrypt to temp dir, set BROWSER_PROFILE_DIR, cleanup on exit
}
```

**Implementation Options**:
1. **Simple**: Encrypt entire `.profiles/` with age/rage (age-encryption.org)
2. **OS Keychain**: Store master key in macOS Keychain / Windows Credential Manager / libsecret
3. **Per-Profile**: Each platform profile encrypted separately

---

## Phase 3: MCP Client Integration (Week 3)

### 3.1 Claude Desktop Config

```json
{
  "mcpServers": {
    "autosocial": {
      "command": "npx",
      "args": ["-y", "@autosocial/mcp-client"],
      "env": {
        "AUTOSOCIAL_API_KEY": "ak_live_xxx"
      }
    }
  }
}
```

### 3.2 MCP Client: `@autosocial/mcp-client`

```typescript
// Thin stdio → HTTPS/WebSocket bridge
// 1. Reads MCP requests from stdin (Claude Desktop)
// 2. Forwards to hosted relay via HTTPS + WebSocket
// 3. Streams responses back to stdout
// 4. Handles reconnection, auth refresh
```

---

## Phase 4: Deploy Hosted Relay (Week 4)

### 4.1 Infrastructure (Minimal)

| Service | Spec | Est. Cost |
|---------|------|-----------|
| Fly.io (2x shared-cpu-1x) | Relay servers | ~$5/mo |
| Redis (Fly.io managed) | Agent registry + pub/sub | ~$5/mo |
| PostgreSQL (Fly.io managed) | API keys, orgs, audit log | ~$5/mo |
| **Total** | | **~$15/mo** |

### 4.2 Relay API Surface

```
POST   /v1/auth/verify       # Validate API key (called by mcp-client)
WS     /v1/agent/connect     # Agent WebSocket endpoint
GET    /health               # LB health check
```

---

## Security Model

| Layer | Protection |
|-------|------------|
| **API Keys** | `ak_live_` prefix, 32-char random, hashed in DB (bcrypt) |
| **Agent Auth** | API key presented on WebSocket connect, validated before register |
| **Tenant Isolation** | Org ID in every message; relay rejects cross-org routing |
| **Profile Encryption** | AES-256-GCM, key in OS keychain, decrypted only in-memory |
| **Transport** | TLS 1.3 everywhere (HTTPS + WSS) |
| **No Credentials in Relay** | Relay never sees cookies, tokens, videos |

---

## Development Roadmap

### Milestone 1: Local Relay + Agent (Week 1)
- [ ] Relay server running locally (`npm run relay`)
- [ ] Agent connects to local relay via WebSocket
- [ ] Tool call round-trip works (Claude Desktop → Relay → Agent → AutoSocial)

### Milestone 2: Profile Encryption (Week 2)
- [ ] Encrypt/decrypt `.profiles/` with age or OS keychain
- [ ] Playwright launches with decrypted profile
- [ ] Auto-cleanup on agent exit/crash

### Milestone 3: Deploy Relay (Week 3)
- [ ] Fly.io deployment with Redis + Postgres
- [ ] API key management (create, revoke, list)
- [ ] Org/agent registry persistence

### Milestone 4: MCP Client + Launch (Week 4)
- [ ] `@autosocial/mcp-client` published to npm
- [ ] Documentation: "Connect Claude Desktop in 3 steps"
- [ ] Dogfood with 3-5 users

---

## Code Changes Required in AutoSocial Core

### 1. Export Services for Agent Import
```typescript
// src/agent-entry.ts - New file
export { 
  getAllAccounts, addAccount, selectAccount, getActiveAccount 
} from "./account-manager";
export { getDaemons, getAllStatus } from "./daemon-registry";
// ... etc
```

### 2. CLI Flag for Headless/Module Mode
```bash
# Current: npm run dashboard (starts Express on :3000)
# New: node src/agent-entry.ts --stdio  # For agent to import
```

### 3. Config: Add Profile Encryption Settings
```env
PROFILE_ENCRYPTION=age           # or "keychain"
PROFILE_KEYCHAIN_SERVICE=autosocial
```

---

## Open Questions

1. **Age vs OS Keychain**: Age is cross-platform, keychain is more user-friendly. Support both?
2. **Agent as Child Process vs In-Process**: Spawn `dashboard-server.js` vs `require()` modules? In-process = simpler, shared memory.
3. **Queue Watching**: Agent needs to watch `queue/` for changes to report status. `chokidar`?
4. **Multi-Account Concurrent**: Can one agent handle multiple accounts simultaneously? Yes, AutoSocial already supports this.

---

## Verdict

**This is buildable in 4 weeks**. The hosted component is tiny (~500 lines). The work is in:
1. Extracting AutoSocial services as importable modules
2. Profile encryption + Playwright integration
3. Agent ↔ Relay WebSocket protocol
4. npm packages + install flow

**No multi-tenant browser infrastructure, no video storage, no GPU costs.**

---

*Corrected plan v2.0 — Local-first architecture with hosted relay only*