const cron = require("node-cron");
const fs = require("fs/promises");
const path = require("path");
const { config } = require("./config");
const { getMediumQueueDir, listQueueArticles } = require("./medium-queue");
const { getDaemons } = require("./daemon-registry");
const { publishStory } = require("./medium-uploader");

function normalizeDailyTimes(times) {
  return [...new Set(times.map((t) => t.trim()).filter(Boolean))].sort();
}

function getLocalTimeKey(timezone) {
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  return local.toTimeString().slice(0, 5);
}

class MediumDaemonController {
  constructor(options = {}) {
    this.accountId = options.accountId;
    this.queueDir = options.queueDir || getMediumQueueDir();
    this.postedDir = options.postedDir || path.resolve(config.projectRoot, "queue/default/medium/posted");
    this.failedDir = options.failedDir || path.resolve(config.projectRoot, "queue/default/medium/failed");
    this.statePath = options.statePath || path.resolve(config.projectRoot, `.scheduler-state/${this.accountId}/medium-scheduler-state.json`);

    this.cronExpression = config.mediumCronExpression || "0 */2 * * *";
    this.schedulePlan = { type: "cron", expression: this.cronExpression };
    this.instantPost = false;
    this.task = null;
    this._watchDebounce = null;
    this._queueWatcher = null;
    this.isPosting = false;
    this.lastRunAt = null;
    this.lastResult = null;
    this.logs = [];

    this._loadState();
  }

  async _loadState() {
    try {
      const content = await fs.readFile(this.statePath, "utf8");
      const state = JSON.parse(content);
      this.cronExpression = state.cronExpression || this.cronExpression;
      this.schedulePlan = state.schedulePlan || this.schedulePlan;
      this.instantPost = state.instantPost || false;
    } catch {
      // ignore missing state
    }
  }

  async _saveState() {
    try {
      await fs.mkdir(path.dirname(this.statePath), { recursive: true });
      await fs.writeFile(this.statePath, JSON.stringify({
        cronExpression: this.cronExpression,
        schedulePlan: this.schedulePlan,
        instantPost: this.instantPost,
      }, null, 2));
    } catch (error) {
      this.log(`Failed to save scheduler state: ${error.message}`, "error");
    }
  }

  log(message, level = "info") {
    const entry = { at: new Date().toISOString(), level, message };
    this.logs.unshift(entry);
    this.logs = this.logs.slice(0, 50);
    const prefix = `[${entry.at}] [medium:${this.accountId}]`;
    if (level === "error") console.error(`${prefix} ${message}`);
    else console.log(`${prefix} ${message}`);
  }

  start() {
    if (this.task) return { ok: true, alreadyRunning: true };
    this.log(`Starting Medium scheduler (${this.schedulePlan.type === "cron" ? this.cronExpression : this.schedulePlan.times.join(", ")})`);
    if (this.schedulePlan.type === "cron") {
      this.task = cron.schedule(this.cronExpression, () => this._scheduleWithJitter("cron"), { timezone: config.timezone });
    } else {
      this._startDailyTimesWatcher();
    }
    return { ok: true };
  }

  stop() {
    if (!this.task && !this._dailyTimesInterval) return { ok: true, alreadyStopped: true };
    if (this.task) this.task.stop();
    if (this._dailyTimesInterval) clearInterval(this._dailyTimesInterval);
    this.task = null;
    this._dailyTimesInterval = null;
    this._watchDebounce = null;
    if (this._queueWatcher) {
      this._queueWatcher.close();
      this._queueWatcher = null;
    }
    this.log("Medium scheduler stopped.");
    return { ok: true };
  }

  async setSchedule(expression) {
    if (!cron.validate(expression)) throw new Error(`Invalid cron expression: ${expression}`);
    this.cronExpression = expression;
    this.schedulePlan = { type: "cron", expression };
    await this._saveState();
    this.log(`Schedule updated to: ${expression}`);
    if (this.task) { this.stop(); this.start(); }
    return { ok: true, cronExpression: this.cronExpression };
  }

  async setDailyTimes(times) {
    const normalized = normalizeDailyTimes(times);
    this.schedulePlan = { type: "daily-times", times: normalized };
    await this._saveState();
    this.log(`Schedule updated to daily times: ${normalized.join(", ")}`);
    if (this.task) { this.stop(); this.start(); }
    return { ok: true, schedulePlan: this.schedulePlan };
  }

  async setInstantPost(enabled) {
    this.instantPost = Boolean(enabled);
    await this._saveState();
    this.log(`Instant post ${enabled ? "ENABLED" : "DISABLED"}`);
    if (enabled) this._startQueueWatcher();
    else this._stopQueueWatcher();
    return { ok: true, instantPost: this.instantPost };
  }

  _startQueueWatcher() {
    if (this._queueWatcher) return;
    try {
      this._queueWatcher = require("fs").watch(this.queueDir, (eventType, filename) => {
        if (eventType === "rename" && filename && filename.endsWith(".json")) {
          this._debounceRun("instant-post");
        }
      });
      this.log("Instant post ENABLED - will post as soon as files land in queue.");
    } catch (err) {
      this.log("Failed to watch queue directory: " + err.message, "error");
    }
  }

  _stopQueueWatcher() {
    if (this._queueWatcher) {
      this._queueWatcher.close();
      this._queueWatcher = null;
    }
  }

  _debounceRun(source) {
    if (this._watchDebounce) clearTimeout(this._watchDebounce);
    this._watchDebounce = setTimeout(() => this.runOnce(source), 2000);
  }

  _startDailyTimesWatcher() {
    this._dailyTimesInterval = setInterval(() => {
      if (!this.task) return;
      const key = getLocalTimeKey(config.timezone);
      if (this.schedulePlan.times.includes(key) && this.lastScheduleTriggerKey !== key) {
        this.lastScheduleTriggerKey = key;
        this.runOnce("daily-times");
      }
    }, 30000);
  }

  async runOnce(source = "manual") {
    if (this.isPosting) {
      return { ok: false, skipped: true, reason: "A post is already in progress." };
    }

    this.isPosting = true;
    this.lastRunAt = new Date().toISOString();
    this.log(`Run triggered by ${source}.`);

    try {
      const result = await publishStory({
        source,
        queueDir: this.queueDir,
        postedDir: this.postedDir,
        failedDir: this.failedDir,
        accountId: this.accountId,
      });
      this.lastResult = result;

      if (result.skipped) {
        this.log(result.reason);
      } else if (result.ok) {
        this.log(`Posted successfully.`);
      } else {
        this.log(`Post failed: ${result.error}`, "error");
        if (result.screenshotPath) this.log(`Screenshot: ${result.screenshotPath}`, "error");
      }

      return result;
    } catch (error) {
      const failedResult = { ok: false, error: error.message || "Unexpected scheduler error" };
      this.lastResult = failedResult;
      this.log(`Post failed: ${failedResult.error}`, "error");
      return failedResult;
    } finally {
      this.isPosting = false;
    }
  }

  async getStatus() {
    const queue = await this.getQueueState();
    return {
      running: Boolean(this.task),
      isPosting: this.isPosting,
      cronExpression: this.cronExpression,
      schedulePlan: this.schedulePlan,
      instantPost: this.instantPost,
      timezone: config.timezone,
      autoAddSound: config.autoAddSound,
      defaultCaption: config.defaultCaption,
      defaultSoundQuery: config.defaultSoundQuery,
      randomQueueOrder: config.randomQueueOrder,
      accountId: this.accountId,
      queue,
      lastRunAt: this.lastRunAt,
      lastResult: this.lastResult,
      logs: this.logs,
    };
  }

  async getQueueState() {
    const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm", ".avi", ".mkv", ".md", ".txt", ".json"]);

    const pendingEntries = await fs.readdir(this.queueDir, { withFileTypes: true });
    const postedEntries = await fs.readdir(this.postedDir, { withFileTypes: true });
    const failedEntries = await fs.readdir(this.failedDir, { withFileTypes: true });

    const isArticle = (entry) => entry.isDirectory() || entry.isFile() && [".json", ".md", ".txt"].includes(path.extname(entry.name).toLowerCase());

    const pendingArticles = pendingEntries
      .filter(isArticle)
      .map((entry) => {
        const isDir = entry.isDirectory();
        const base = isDir ? entry.name : entry.name.replace(/\.(json|md|txt)$/, "");
        const hasMeta = pendingEntries.some(e => e.isFile() && e.name === `${base}.json`);
        return { name: entry.name, isDir, hasMeta };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      counts: { pending: pendingArticles.length, posted: postedEntries.filter(isArticle).length, failed: failedEntries.filter(isArticle).length },
      pendingArticles,
    };
  }
}

async function postNextFromQueue({ source, queueDir, postedDir, failedDir, accountId } = {}) {
  const qDir = queueDir || getMediumQueueDir();
  const pDir = postedDir || path.resolve(config.projectRoot, "queue/default/medium/posted");
  const fDir = failedDir || path.resolve(config.projectRoot, "queue/default/medium/failed");

  await fs.mkdir(pDir, { recursive: true });
  await fs.mkdir(fDir, { recursive: true });

  const articles = await listQueueArticles(qDir);
  const next = pickNextArticle(articles);
  if (!next) {
    return { ok: true, skipped: true, reason: "Medium queue is empty." };
  }

  try {
    const result = await publishStory({
      title: next.title,
      body: next.body,
      tags: next.tags || [],
      publishStatus: next.publishStatus || "public",
      canonicalUrl: next.canonicalUrl || "",
      accountId,
    });

    if (result.ok) {
      await moveToPosted(next.articleDir, pDir, next.id);
      return { ok: true, movedArticle: next.id };
    } else {
      await moveToFailed(next.articleDir, fDir, next.id, result.error);
      return { ok: false, error: result.error, screenshotPath: result.screenshotPath };
    }
  } catch (error) {
    await moveToFailed(next.articleDir, fDir, next.id, error.message);
    return { ok: false, error: error.message };
  }
}

module.exports = {
  MediumDaemonController,
  normalizeDailyTimes,
  getLocalTimeKey,
  postNextFromQueue,
};