const fs = require("fs/promises");
const path = require("path");
const { config } = require("./config");

function getMediumQueueDir() {
  return path.resolve(config.projectRoot, process.env.MEDIUM_QUEUE_DIR || "queue/default/medium/pending");
}

async function listQueueArticles(queueDir = null) {
  const dir = queueDir || getMediumQueueDir();
  const articles = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const articleDir = path.join(dir, entry.name);
      const metaPath = path.join(articleDir, "post.json");
      const bodyPath = path.join(articleDir, "body.md");

      let meta;
      try {
        const metaContent = await fs.readFile(metaPath, "utf8");
        meta = JSON.parse(metaContent);
      } catch {
        continue;
      }

      let body = "";
      try {
        body = await fs.readFile(bodyPath, "utf8");
      } catch {
        body = "";
      }

      articles.push({
        id: entry.name,
        title: meta.title || entry.name,
        tags: meta.tags || [],
        publishStatus: meta.publishStatus || "public",
        canonicalUrl: meta.canonicalUrl || "",
        body,
        bodyPath,
        metaPath,
        articleDir,
      });
    }
  } catch {
    return [];
  }

  articles.sort((a, b) => a.id.localeCompare(b.id));
  return articles;
}

function pickNextArticle(articles) {
  if (articles.length === 0) return null;
  if (config.randomQueueOrder) {
    return articles[Math.floor(Math.random() * articles.length)];
  }
  return articles[0];
}

async function getNextQueuedArticle(queueDir = null) {
  const articles = await listQueueArticles(queueDir);
  const next = pickNextArticle(articles);
  if (!next) return null;
  return next;
}

module.exports = {
  getMediumQueueDir,
  listQueueArticles,
  getNextQueuedArticle,
};