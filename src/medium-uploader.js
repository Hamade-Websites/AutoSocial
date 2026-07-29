const path = require("path");
const { config } = require("./config");
const { getMediumQueueDir } = require("./medium-queue");
const { getPlatformProfileDir, hasSavedPlatformSession } = require("./account-manager");
const { chromium } = require("playwright");

const MEDIUM_UI_LABELS = {
  write: ["Write", "Write story", "New story"],
  title: ["Title", "Your title", "Story title"],
  body: ["Write here...", "Tell your story", "Start writing"],
  publish: ["Publish", "Publish now"],
  publishDropdown: ["Publish", "Publish options"],
  publishNow: ["Publish now", "Publish immediately"],
  published: ["Published", "Story published", "Your story is live"],
  error: ["Error", "Failed", "Couldn't publish"],
  confirmPublish: ["Publish", "Confirm"],
  tags: ["Add tags", "Tags", "Topics"],
  tagInput: ["Add a tag", "Search tags"],
};

let loginSessionContext = null;
let loginSessionAccountId = null;

async function openPersistentContext(accountId) {
  const profileDir = await getPlatformProfileDir("medium", accountId);
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: config.headless,
    locale: config.browserLocale,
    viewport: { width: 1280, height: 800 },
    args: ["--disable-blink-features=AutomationControlled"],
  });
  return context;
}

async function gotoWritePage(page) {
  await page.goto("https://medium.com/new-story", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
}

async function startLoginSession() {
  const { getActiveAccount } = require("./account-manager");
  const activeAccount = await getActiveAccount();

  if (loginSessionContext && loginSessionAccountId !== activeAccount.id) {
    const previous = loginSessionContext;
    loginSessionContext = null;
    loginSessionAccountId = null;
    await previous.close().catch(() => {});
  }

  if (loginSessionContext) {
    return { ok: true, alreadyOpen: true };
  }

  const context = await openPersistentContext(activeAccount.id);
  const page = context.pages()[0] || await context.newPage();
  loginSessionContext = context;
  loginSessionAccountId = activeAccount.id;

  context.on("close", () => {
    if (loginSessionContext === context) {
      loginSessionContext = null;
      loginSessionAccountId = null;
    }
  });

  await gotoWritePage(page);
  return { ok: true, alreadyOpen: false, url: page.url() };
}

async function getLoginSessionStatus() {
  const { getActiveAccount } = require("./account-manager");
  const activeAccount = await getActiveAccount();
  const saved = await hasSavedPlatformSession("medium", activeAccount.id);
  return {
    open: Boolean(loginSessionContext) && loginSessionAccountId === activeAccount.id,
    saved,
  };
}

async function closeLoginSession() {
  if (!loginSessionContext) {
    return { ok: true, alreadyClosed: true };
  }
  const context = loginSessionContext;
  loginSessionContext = null;
  loginSessionAccountId = null;
  await context.close().catch(() => {});
  return { ok: true, alreadyClosed: false };
}

async function publishStory({ title, body, tags = [], publishStatus = "public", canonicalUrl = "", accountId }) {
  const context = await openPersistentContext(accountId);
  const page = context.pages()[0] || await context.newPage();
  let closeHoldMs = 0;

  try {
    await gotoWritePage(page);
    await page.waitForTimeout(3000);

    // Enter title
    const titleSelectors = [
      'h1[contenteditable="true"]',
      '[data-testid="titleField"]',
      'h1:has-text("Title")',
    ];
    let titleFilled = false;
    for (const sel of titleSelectors) {
      try {
        await page.fill(sel, title, { timeout: 5000 });
        titleFilled = true;
        break;
      } catch {}
    }
    if (!titleFilled) throw new Error("Could not find title field");

    // Enter body
    const bodySelectors = [
      '[data-testid="editor"]',
      'article[contenteditable="true"]',
      'section[contenteditable="true"]',
    ];
    let bodyFilled = false;
    for (const sel of bodySelectors) {
      try {
        await page.fill(sel, body, { timeout: 5000 });
        bodyFilled = true;
        break;
      } catch {}
    }
    if (!bodyFilled) throw new Error("Could not find body editor");

    // Add tags
    if (tags.length > 0) {
      try {
        await page.click('button:has-text("Publish")', { timeout: 3000 });
        await page.waitForTimeout(1000);
        await page.click('button:has-text("Add tags")', { timeout: 3000 });
        await page.waitForTimeout(500);
        for (const tag of tags.slice(0, 5)) {
          await page.fill('input[placeholder*="tag" i]', tag, { timeout: 3000 });
          await page.keyboard.press("Enter");
          await page.waitForTimeout(300);
        }
        await page.keyboard.press("Escape");
      } catch {}
    }

    // Click publish
    const published = await clickPublish(page);
    if (!published.ok) throw new Error(published.reason);

    return { ok: true };
  } catch (error) {
    const screenshotPath = path.resolve(config.projectRoot, "last-medium-upload-error.png");
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    return { ok: false, error: error.message, screenshotPath };
  } finally {
    await context.close();
  }
}

async function clickPublish(page) {
  for (let i = 0; i < 3; i++) {
    try {
      await page.click('button:has-text("Publish")', { timeout: 5000 });
      await page.waitForTimeout(2000);

      const confirmBtn = await page.$('button:has-text("Publish now"), button:has-text("Publish"), button:has-text("Confirm")');
      if (confirmBtn) {
        await confirmBtn.click();
        await page.waitForTimeout(3000);
      }

      const bodyText = await page.locator("body").innerText().catch(() => "");
      if (/published|story is live|your story is live/i.test(bodyText)) {
        return { ok: true };
      }
      if (/error|failed|couldn't publish/i.test(bodyText)) {
        return { ok: false, reason: "Medium reported an error while publishing." };
      }
    } catch (e) {
      if (i === 2) throw e;
      await page.waitForTimeout(5000);
    }
  }
  return { ok: false, reason: "No reliable publish confirmation within timeout." };
}

async function startLoginSessionCli() {
  const result = await startLoginSession();

  console.log("");
  console.log("Log in to Medium in the opened browser window.");
  console.log("After login is complete, press Ctrl+C in this terminal.");
  console.log("Your session will be reused for future automated posts.");
  console.log("");

  if (result.alreadyOpen) return;

  await new Promise(() => {});
}

module.exports = {
  startLoginSession,
  startLoginSessionCli,
  startDashboardLoginSession: startLoginSession,
  getLoginSessionStatus,
  closeLoginSession,
  publishStory,
};