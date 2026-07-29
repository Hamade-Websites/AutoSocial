# Medium Posting Support - SPEC.md

## 1. ARCHITECTURE OVERVIEW

### 1.1 Goal
Add Medium.com posting support to AutoSocial Studio using Playwright browser automation (no public API available). Follow existing patterns for TikTok, Instagram, YouTube.

### 1.2 Key Differences from Video Platforms
- **Content type**: Long-form articles (Markdown/HTML) + optional images
- **No video upload**: Medium articles are text-based with embedded images
- **Editor UI**: Rich text editor (Trix/ProseMirror) vs file upload dialog
- **No scheduling API**: Must use browser automation for scheduled posts via queue watcher

### 1.3 Integration Points
- Extend `account-manager.js` for Medium profile dir
- Add `medium-queue.js` (follows `queue.js` pattern)
- Add `medium-post-service.js` (follows `post-service.js`)
- Add `medium-uploader.js` (follows `tiktok-uploader.js`)
- Add `MediumDaemonController` (follows `DaemonController`)
- Register in `dashboard-server.js` endpoints
- Add Medium to `PLATFORMS` array in `setup-health.js`

## 2. FILE CHANGES

### 2.1 New Files

```
src/
├── medium-queue.js              # Queue operations (list, getNext)
├── medium-post-service.js       # Post next from queue logic
├── medium-uploader.js           # Playwright automation: login, post
├── medium-daemon-controller.js  # Scheduler controller
├── test/medium-uploader.test.js # Unit tests for selector logic
```

### 2.2 Modified Files

| File | Changes |
|------|---------|
| `src/config.js` | Add Medium queue dirs, cron, URLs, profile dir |
| `src/account-manager.js` | Add Medium to PLATFORMS, queue dirs, profile dir |
| `src/daemon-registry.js` | Import & instantiate MediumDaemonController |
| `src/dashboard-server.js` | Add `/api/medium/*` endpoints, login endpoints |
| `src/setup-health.js` | Add Medium to PLATFORMS, checks, folders, sessions |
| `src/cli.js` | (Optional) Add medium commands if needed |
| `package.json` | No new deps (uses existing Playwright) |

## 3. DATA MODELS & INTERFACES

### 3.1 Config Additions (config.js)
```js
const config = {
  // ... existing ...
  mediumQueueDir: path.resolve(projectRoot, process.env.MEDIUM_QUEUE_DIR || "queue/default/medium/pending"),
  mediumPostedDir: path.resolve(projectRoot, process.env.MEDIUM_POSTED_DIR || "queue/default/medium/posted"),
  mediumFailedDir: path.resolve(projectRoot, process.env.MEDIUM_FAILED_DIR || "queue/default/medium/failed"),
  mediumProfileDir: path.resolve(projectRoot, process.env.MEDIUM_PROFILE_DIR || ".profile-medium"),
  mediumCronExpression: process.env.MEDIUM_CRON_EXPRESSION || "0 */2 * * *",
  mediumUploadUrl: process.env.MEDIUM_UPLOAD_URL || "https://medium.com/new-story",
};

config.platformQueues = {
  // ... existing ...
  medium: config.mediumQueueDir,
};
```

### 3.2 Queue Item Structure (medium-queue.js)
```js
// Each article in queue/pending/ is a directory:
// queue/<account>/medium/pending/<job-id>/
//   ├── post.json          # { title, tags[], canonicalUrl?, publishStatus: "draft"|"public"|"unlisted" }
//   ├── body.md            # Markdown content
//   └── assets/            # Optional images referenced in body
//       ├── image1.png
//       └── image2.jpg

// post.json schema:
const MediumPostSchema = z.object({
  title: z.string().min(1).max(100),
  tags: z.array(z.string().max(25)).max(5).default([]),
  canonicalUrl: z.string().url().optional(),
  publishStatus: z.enum(["draft", "public", "unlisted"]).default("public"),
});
```

### 3.3 Medium Upload Result (medium-uploader.js)
```js
const UploadResultSchema = z.object({
  ok: z.boolean(),
  skipped: z.boolean().optional(),
  reason: z.string().optional(),
  error: z.string().optional(),
  screenshotPath: z.string().optional(),
  articleUrl: z.string().url().optional(),  // On success
});
```

### 3.4 Dashboard Endpoints (NEW)
```
GET  /api/medium/status           → Daemon status
POST /api/medium/start            → Start scheduler
POST /api/medium/stop             → Stop scheduler
POST /api/medium/run-once         → Post next queued article
POST /api/medium/schedule         → Set cron expression
POST /api/medium/schedule-plan    → Set daily times
POST /api/medium/instant-post     → Toggle queue watcher

POST /api/medium/login            → Start login session
GET  /api/medium/login/status     → Check login status
POST /api/medium/login/close      → Close login browser
```

## 4. API CONTRACTS

### 4.1 Medium Uploader Functions
```js
// medium-uploader.js
async function startLoginSession()           // Opens browser for manual login
async function getLoginSessionStatus()       // { open: bool, saved: bool }
async function closeLoginSession()           // Closes browser
async function uploadArticle({              // Called by post-service
  articlePath,      // Path to queue item directory
  accountId,
  source = "daemon"
}) => UploadResult
```

### 4.2 Daemon Controller Interface
```js
// medium-daemon-controller.js
class MediumDaemonController {
  constructor({ accountId, queueDir, postedDir, failedDir, statePath })
  async setSchedule(expression)              // Cron string
  async setDailyTimes(times[])               // ["09:00", "18:00"]
  async setInstantPost(enabled: boolean)     // Queue watcher
  start()                                     // Begin scheduling
  stop()                                      // Stop scheduling
  async runOnce(source)                      // Manual trigger
  async getStatus()                           // Queue counts, running state
}
```

### 4.3 Error Codes (Medium-specific)
| Code | HTTP | Retryable | Description |
|------|------|-----------|-------------|
| `MEDIUM_LOGIN_REQUIRED` | 400 | No | No saved session, login needed |
| `MEDIUM_SELECTOR_CHANGED` | 500 | Yes | Playwright selector failed |
| `MEDIUM_PUBLISH_FAILED` | 500 | Yes | Publish button click failed |
| `MEDIUM_ARTICLE_EMPTY` | 400 | No | Title or body missing |
| `MEDIUM_RATE_LIMITED` | 429 | Yes | Medium rate limit hit |

## 5. TEST STRATEGY (TDD)

### 5.1 Test Order
1. `test/medium-queue.test.js` - Queue list/getNext
2. `test/medium-uploader.test.js` - Selector logic, candidate scoring
3. `test/medium-post-service.test.js` - Post next from queue
4. `test/medium-daemon-controller.test.js` - Scheduler logic
4. Integration: dashboard endpoints

### 5.2 Required Unit Cases

**medium-queue.test.js**
- Lists only `.md` files in pending dir
- Reads title/tags from post.json
- Sorts alphabetically (or random if RANDOM_QUEUE_ORDER)
- Returns null when queue empty

**medium-uploader.test.js** (selector logic extracted to `_private`)
- `isLikelyPublishCandidate()` - Scores "Publish" button vs "Save" vs navigation
- `getPublishCandidateScore()` - Prefers bottom-right primary button
- `getArticleTitleInput()` - Finds title field
- `getArticleBodyEditor()` - Locates Trix/ProseMirror editor
- `getPublishButton()` - Handles primary/secondary confirm dialogs

**medium-post-service.test.js**
- Calls uploader with correct article path
- Moves to posted/ on success, failed/ on error
- Handles sidecar caption (post.json) correctly

**medium-daemon-controller.test.js**
- Cron parsing and next-run calculation
- Daily times trigger at correct local time
- Instant post watches queue dir for new files
- State persists across restarts (statePath JSON)

## 6. MIGRATION STEPS

1. **Add config keys** to `config.js` with env defaults
2. **Create `src/medium-queue.js`** with tests → implement → pass
3. **Create `src/medium-uploader.js`** with selector tests → implement login/upload
4. **Create `src/medium-post-service.js`** → tests → integrate uploader
5. **Create `src/medium-daemon-controller.js`** → tests → scheduler
6. **Update `src/account-manager.js`** → add Medium to PLATFORMS, queue dirs
7. **Update `src/daemon-registry.js`** → instantiate MediumDaemonController
8. **Update `src/dashboard-server.js`** → add `/api/medium/*` endpoints
9. **Update `src/setup-health.js`** → add Medium checks, folders, sessions
10. **Verify**: `npm run check` → all tests pass, dashboard loads

## 7. RISK ASSESSMENT

| Risk | Severity | Mitigation |
|------|----------|------------|
| Medium UI selector changes | High | Extract selectors to constants, add debug screenshots, fallback selectors |
| No official API - scraping fragile | High | Conservative delays, human-like behavior, robust wait conditions |
| Rich text editor (Trix) automation | Medium | Use `page.evaluate()` for content injection, avoid keystroke simulation |
| Image upload in editor | Medium | Drag-drop or file input, wait for CDN URL |
| Rate limiting / auth challenges | Medium | Respect delays, rotate user agents, handle 2FA |
| Scheduled posts without API | Medium | Queue watcher + instant post mode, cron scheduler |
| Article state (draft/published) | Low | Support `publishStatus` in post.json, default "public" |

## 8. MEDIUM-SPECIFIC IMPLEMENTATION NOTES

### 8.1 Login Flow
1. Navigate to `https://medium.com/me/stories/drafts`
2. Click "Sign in" → Google/GitHub/Email
3. Wait for redirect to `/me/stories/drafts`
4. Save browser context to `.profiles/<account>/medium/`

### 8.2 Article Creation Flow
1. Navigate to `https://medium.com/new-story`
2. Wait for Trix editor to load
3. Fill title: `await page.fill('[data-testid="titleInput"]', title)`
4. Inject body: `await page.evaluate((html) => { editor.loadHTML(html) }, bodyHtml)`
5. Add tags: Click tag button → type each tag → Enter
6. Set canonical URL if provided
7. Click "Publish" → handle confirm dialog → select "Public"/"Unlisted"/"Draft"
8. Wait for success toast → extract article URL from URL bar or toast

### 8.3 Image Handling
- Parse `body.md` for `![alt](assets/image.png)`
- For each image: upload via editor toolbar → wait for CDN URL → replace markdown with Medium image embed
- Or: use `page.setInputFiles()` on hidden file input in editor

### 8.4 Config Keys for .env
```env
MEDIUM_CRON_EXPRESSION=0 */2 * * *
MEDIUM_QUEUE_DIR=queue/default/medium/pending
MEDIUM_POSTED_DIR=queue/default/medium/posted
MEDIUM_FAILED_DIR=queue/default/medium/failed
MEDIUM_PROFILE_DIR=.profile-medium
MEDIUM_UPLOAD_URL=https://medium.com/new-story
```