const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { listQueueArticles, getNextQueuedArticle } = require("../src/medium-queue.js");
const { config } = require("../src/config.js");

function makeTestDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "autosocial-medium-"));
}

function writeArticle(dir, id, data) {
  const articleDir = path.join(dir, id);
  fs.mkdirSync(articleDir, { recursive: true });
  fs.writeFileSync(path.join(articleDir, "post.json"), JSON.stringify(data.meta, null, 2));
  fs.writeFileSync(path.join(articleDir, "body.md"), data.body);
  if (data.assets) {
    fs.mkdirSync(path.join(articleDir, "assets"), { recursive: true });
    for (const [name, content] of Object.entries(data.assets)) {
      fs.writeFileSync(path.join(articleDir, "assets", name), content);
    }
  }
}

test("listQueueArticles returns empty array for empty directory", async () => {
  const dir = makeTestDir();
  try {
    const articles = await listQueueArticles(dir);
    assert.deepEqual(articles, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("listQueueArticles reads article metadata from post.json", async () => {
  const dir = makeTestDir();
  try {
    writeArticle(dir, "article-1", {
      meta: { title: "First Article", tags: ["tech", "ai"], publishStatus: "public" },
      body: "# Hello World\n\nContent here.",
    });
    writeArticle(dir, "article-2", {
      meta: { title: "Second Article", tags: ["coding"], publishStatus: "draft" },
      body: "# Another Post\n\nMore content.",
    });

    const articles = await listQueueArticles(dir);
    assert.equal(articles.length, 2);
    assert.equal(articles[0].id, "article-1");
    assert.equal(articles[0].title, "First Article");
    assert.deepEqual(articles[0].tags, ["tech", "ai"]);
    assert.equal(articles[0].publishStatus, "public");
    assert.ok(articles[0].body.includes("Hello World"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("listQueueArticles sorts alphabetically by default", async () => {
  const dir = makeTestDir();
  try {
    writeArticle(dir, "zebra", { meta: { title: "Z" }, body: "z" });
    writeArticle(dir, "alpha", { meta: { title: "A" }, body: "a" });
    const articles = await listQueueArticles(dir);
    assert.equal(articles[0].id, "alpha");
    assert.equal(articles[1].id, "zebra");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("listQueueArticles ignores non-directories and invalid articles", async () => {
  const dir = makeTestDir();
  try {
    writeArticle(dir, "valid", { meta: { title: "Valid" }, body: "ok" });
    fs.writeFileSync(path.join(dir, "not-a-dir.txt"), "ignore me");
    fs.mkdirSync(path.join(dir, "missing-post-json"));
    // missing post.json should be skipped
    const articles = await listQueueArticles(dir);
    assert.equal(articles.length, 1);
    assert.equal(articles[0].id, "valid");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("getNextQueuedArticle returns first article", async () => {
  const dir = makeTestDir();
  try {
    writeArticle(dir, "article-1", { meta: { title: "First" }, body: "one" });
    writeArticle(dir, "article-2", { meta: { title: "Second" }, body: "two" });

    const article = await getNextQueuedArticle(dir);
    assert.ok(article);
    assert.equal(article.id, "article-1");
    assert.equal(article.title, "First");
    assert.ok(article.bodyPath.endsWith("body.md"));
    assert.ok(article.metaPath.endsWith("post.json"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("getNextQueuedArticle returns null for empty queue", async () => {
  const dir = makeTestDir();
  try {
    const article = await getNextQueuedArticle(dir);
    assert.equal(article, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});