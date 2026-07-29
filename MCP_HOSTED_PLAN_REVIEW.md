# Adversarial Review: AutoSocial Hosted MCP Plan

**Reviewer**: Adversarial Review Agent  
**Date**: 2026-07-27  
**Plan Version**: 1.0  
**Severity Scale**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | 🔵 Info

---

## Executive Summary

The plan is **comprehensive but has critical gaps** in security architecture, multi-tenancy, and operational maturity. It reads more like a "build an MCP server" tutorial than a production SaaS architecture. Several 🔴 Critical and 🟠 High findings must be addressed before any implementation begins.

---

## 🔴 Critical Findings

### CRIT-01: No Multi-Tenant Architecture Defined
**Location**: Plan assumes single-tenant throughout
**Issue**: The plan describes a single MCP server connecting to *one* AutoSocial instance. A hosted SaaS requires:
- Tenant isolation (data, browser profiles, queues)
- Per-tenant API keys / auth
- Resource quotas (VRAM, CPU, queue slots)
- Billing integration per tenant
**Impact**: Cannot onboard more than 1 customer without code changes.
**Fix**: Define tenant model, isolation boundaries, and routing layer *before* writing MCP server code.

### CRIT-02: Browser Profile Security Model Missing
**Location**: Plan mentions "Playwright Chromium" but no isolation strategy
**Issue**: AutoSocial stores `.profiles/<account>/<platform>` with full browser state (cookies, localStorage, session tokens). In a hosted environment:
- Profiles contain **live social media credentials**
- No encryption-at-rest specified
- No profile rotation/expiry
- Cross-tenant profile leakage risk if filesystem shared
**Impact**: Credential theft = account takeover = platform bans = legal liability.
**Fix**: 
- Encrypt profiles with per-tenant keys (KMS/HSM)
- Run each tenant's browser in isolated container/VM
- Profile lifecycle management (auto-expire, revoke)

### CRIT-03: No Authentication/Authorization on MCP Endpoints
**Location**: Plan shows raw SSE + stdio transports
**Issue**: MCP protocol has **no built-in auth**. The plan exposes:
- `/mcp/sse` — unauthenticated
- `/mcp/message` — unauthenticated
- Tool calls execute browser automation with stored credentials
**Impact**: Anyone with URL can post to customer's TikTok/Instagram/YouTube.
**Fix**: 
- OAuth 2.1 / OIDC for MCP clients
- Short-lived access tokens per tenant
- Tool-level authorization (e.g., `post` requires `social:write` scope)

### CRIT-04: Video File Handling at Scale Not Addressed
**Location**: "Video Storage" open question
**Issue**: AutoSocial queues videos locally (`queue/<account>/<platform>/pending`). Hosted:
- 1 video ≈ 50-500MB
- 100 users × 10 videos = 50-500GB
- Upload bandwidth, transcoding (uniquifier), storage costs
- No CDN, no chunked upload, no resume
**Impact**: OOM kills, storage bill shock, failed uploads.
**Fix**: S3-compatible storage + presigned URLs + background workers + lifecycle policies.

---

## 🟠 High Findings

### HIGH-01: Single Point of Failure — Browser Automation
**Location**: "RunPod pod" architecture
**Issue**: Playwright + Chromium is fragile:
- Chrome updates break selectors weekly
- Memory leaks in long-running contexts
- GPU/VM instability on cloud providers
- No health checks / auto-recovery specified
**Fix**: 
- Sidecar health monitor per browser instance
- Automated selector healing (ML-based?)
- Circuit breaker + graceful degradation
- Blue/green browser version deployment

### HIGH-02: Platform ToS Violations Not Mitigated
**Location**: "Responsible Use" section in README only
**Issue**: Hosting automation **amplifies** ToS risk:
- You become the "operator" not the user
- DMCA/complaint liability shifts to you
- Platform detection of datacenter IPs = instant bans
- No residential proxy integration planned
**Fix**: 
- Residential proxy pool (expensive but required)
- Rate limiting per platform below detection thresholds
- Automated appeal workflow
- Legal review of ToS for each platform

### HIGH-03: No Observability / Debugging Story
**Location**: Plan mentions "health check" only
**Issue**: When (not if) browser automation fails:
- No distributed tracing
- No session replay
- No structured logging correlation (MCP request → browser action → platform response)
- No alerting on queue depth, failure rate, login expiry
**Fix**: OpenTelemetry + Grafana/Tempo + Sentry + custom dashboards per tenant.

### HIGH-04: MCP Protocol Versioning Strategy Absent
**Location**: Uses `@modelcontextprotocol/sdk` v1
**Issue**: MCP spec evolving rapidly. Breaking changes likely.
- No version negotiation in plan
- No backward compatibility testing
- Client (Claude Desktop, Cursor, etc.) version matrix not considered
**Fix**: Pin protocol version, test against multiple clients, maintain compat layer.

### HIGH-05: Billing / Usage Metering Undefined
**Location**: "Pricing Model" open question
**Issue**: Can't charge without metering:
- Browser-minutes (GPU time)
- Video GB stored/processed
- API calls per platform
- Queue slots reserved
**Fix**: Design metering events *before* code. Integrate with Stripe Metered Billing or Lago.

---

## 🟡 Medium Findings

### MED-01: Windows-Only Dependency (yt-dlp.exe)
**Location**: `autodownload/download_tiktok.bat`, README mentions Windows primary
**Issue**: Hosted Linux containers can't run `.bat` / `.exe` natively.
**Fix**: Use `yt-dlp` Python package or static Linux binary.

### MED-02: Hardcoded Defaults in Config
**Location**: `config.js` — cron expressions, delays, URLs
**Issue**: SaaS needs per-tenant config with validation, not env-file defaults.
**Fix**: Config schema (Zod) + tenant config API + UI.

### MED-03: No Disaster Recovery / Backup Plan
**Location**: Not mentioned
**Issue**: Browser profiles = irreplaceable auth state. Loss = customer re-logs into all accounts.
**Fix**: Automated encrypted backup of `.profiles/` to S3 + point-in-time restore.

### MED-04: Single-Region Deployment
**Location**: Fly.io / RunPod implied
**Issue**: Latency for global customers; no failover.
**Fix**: Multi-region with profile replication (eventually consistent).

### MED-05: Agent Auto-Update Mechanism
**Location**: "Self-update" mentioned for comfyui-mcp only
**Issue**: Hosted agent on customer machine (RunPod) needs secure update channel.
**Fix**: Signed releases, staged rollout, rollback capability.

---

## 🟢 Low / Info Findings

### LOW-01: MCP Tool Surface Too Large
**Location**: Plan lists 20+ tools mirroring dashboard API
**Issue**: MCP clients (LLMs) struggle with >15 tools. Tool choice paralysis.
**Fix**: Group into composite workflows (e.g., `post_to_tiktok` = login + queue + schedule + post).

### LOW-02: No Local Development Parity
**Location**: Plan assumes cloud-only
**Issue**: Contributors can't test against "hosted" features locally.
**Fix**: `docker-compose.yml` with localstack, testcontainers, mock browser.

### LOW-03: Missing: Webhook / Event Streaming
**Location**: Not in plan
**Issue**: Customers want real-time: "post published", "login expired", "quota exceeded".
**Fix**: Server-Sent Events or webhook delivery with retry/backoff.

### LOW-04: Documentation Gaps
**Location**: Plan mentions "landing page" only
**Issue**: Need: API reference, SDK examples, Terraform provider, migration guide.

---

## 🔵 Architectural Recommendations

### 1. Adopt a Proper Multi-Tenant MCP Gateway Pattern

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  MCP Client │────▶│  Auth Gateway │────▶│  Tenant Router   │
│ (Claude,    │     │  (OAuth/OIDC) │     │  (per-tenant     │
│  Cursor)    │     │               │     │   MCP server)    │
└─────────────┘     └──────────────┘     └────────┬─────────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────────┐
                    ▼                             ▼                     ▼
             ┌─────────────┐              ┌─────────────┐       ┌─────────────┐
             │ Tenant A    │              │ Tenant B    │       │ Tenant N    │
             │ - Profiles  │              │ - Profiles  │       │ - Profiles  │
             │ - Queues    │              │ - Queues    │       │ - Queues    │
             │ - Browser   │              │ - Browser   │       │ - Browser   │
             └─────────────┘              └─────────────┘       └─────────────┘
```

### 2. Use a Job Queue System (Not In-Process)
- Current: `node-cron` in-process
- Required: **Redis + BullMQ** or **Temporal** for:
  - Durability across restarts
  - Horizontal scaling
  - Retry/dead-letter
  - Visibility/timeouts

### 3. Browser Pool Management
```typescript
interface BrowserPool {
  acquire(tenantId: string, platform: Platform): Promise<BrowserContext>;
  release(context: BrowserContext): Promise<void>;
  healthCheck(): Promise<PoolHealth>;
  scale(target: number): Promise<void>;
}
```
- Warm pool per tenant/platform
- Context isolation (not just page isolation)
- Automatic recycling after N operations

### 4. Secrets Management
- **Never** store `.env` in container
- Use: AWS Secrets Manager / GCP Secret Manager / HashiCorp Vault
- Inject at runtime, rotate automatically

### 5. Compliance Baseline
- SOC 2 Type II readiness from day 1
- GDPR: Data export/delete API
- Platform-specific: TikTok Marketing API vs scraping distinction

---

## 📋 Required Before Implementation

| # | Artifact | Owner | Due |
|---|----------|-------|-----|
| 1 | Threat Model (STRIDE) | Security | Week 1 |
| 2 | Multi-Tenant Data Model | Architecture | Week 1 |
| 3 | AuthZ/AuthN Spec (OAuth 2.1 + scopes) | Platform | Week 1 |
| 4 | Browser Isolation PoC | Engineering | Week 2 |
| 5 | Cost Model (per-tenant GPU, storage, egress) | Finance/Eng | Week 1 |
| 6 | Platform ToS Legal Review | Legal | Week 1 |
| 7 | Observability Stack Decision | Platform | Week 2 |
| 8 | Disaster Recovery Runbook | SRE | Week 3 |

---

## Verdict

**DO NOT START CODING** until Critical findings are resolved. The plan describes a prototype, not a product. Minimum 4-6 weeks of architecture/spike work before first line of MCP server code.

**Recommended Path**:
1. **Week 1-2**: Spikes on browser isolation, auth, multi-tenancy
2. **Week 3**: Threat model + legal review
3. **Week 4-6**: Build minimal multi-tenant gateway + 1 tenant pilot
4. **Week 7+**: Iterate with real customers

---

*Review conducted per adversarial methodology: assume attacker mindset, question every assumption, prioritize security/operational risk over feature velocity.*