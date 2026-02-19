require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_ORG = process.env.GITHUB_ORG;

if (!GITHUB_TOKEN || !GITHUB_ORG) {
  console.error('❌  Missing GITHUB_TOKEN or GITHUB_ORG in .env file.');
  console.error('    Copy .env.example → .env and fill in your values.');
  process.exit(1);
}

const HEADERS = {
  Authorization: `token ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github.v3+json',
  'User-Agent': 'hackathon-dashboard',
};

// Simple in-memory cache (55 second TTL so refresh lands before the 60s frontend poll)
let cache = null;
let cacheTime = 0;
const CACHE_TTL_MS = 55_000;

/**
 * Get total commit count for a repo using the Link header pagination trick.
 * A single request with per_page=1 returns the last page number in the Link header,
 * which equals the total commit count — zero additional requests needed.
 */
async function getCommitCount(org, repo) {
  const url = `https://api.github.com/repos/${org}/${repo}/commits?per_page=1&sha=HEAD`;
  const res = await fetch(url, { headers: HEADERS });

  if (!res.ok) {
    // Repo may be empty or inaccessible
    if (res.status === 409 || res.status === 404) return 0;
    console.warn(`  ⚠  ${repo}: HTTP ${res.status} — skipping`);
    return 0;
  }

  const link = res.headers.get('link');
  if (!link) {
    // If there's no Link header there is only 1 page → check if body has commits
    const data = await res.json();
    return Array.isArray(data) ? data.length : 0;
  }

  // Parse the last page number from: <https://...?page=42>; rel="last"
  const match = link.match(/[&?]page=(\d+)>;\s*rel="last"/);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Fetch all repos in the org and return commit counts for each.
 */
async function fetchTeamData() {
  let repos = [];
  let page = 1;

  // Paginate through all repos
  while (true) {
    const url = `https://api.github.com/orgs/${GITHUB_ORG}/repos?per_page=100&page=${page}&type=all`;
    const res = await fetch(url, { headers: HEADERS });

    if (!res.ok) {
      throw new Error(`Failed to list repos: HTTP ${res.status} — ${await res.text()}`);
    }

    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    repos = repos.concat(batch);
    if (batch.length < 100) break;
    page++;
  }

  console.log(`  Found ${repos.length} repos in ${GITHUB_ORG}`);

  // Fetch commit counts in parallel (with a small concurrency cap to be kind to the API)
  const CONCURRENCY = 5;
  const results = [];

  for (let i = 0; i < repos.length; i += CONCURRENCY) {
    const chunk = repos.slice(i, i + CONCURRENCY);
    const counts = await Promise.all(
      chunk.map(async (repo) => {
        const commits = await getCommitCount(GITHUB_ORG, repo.name);
        console.log(`    ${repo.name}: ${commits} commits`);
        return { team: repo.name, commits };
      })
    );
    results.push(...counts);
  }

  // Sort descending by commits
  return results.sort((a, b) => b.commits - a.commits);
}

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Serve the rotating display-info markdown file
app.get('/api/info', (req, res) => {
  const fs = require('fs');

  const configPath = path.join(__dirname, 'config.json');
  let activeFiles = ['display-info.md']; // Fallback
  let rotationInterval = 180; // Default 3 mins

  // Try to load config
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.activeFiles && Array.isArray(config.activeFiles) && config.activeFiles.length > 0) {
        activeFiles = config.activeFiles;
      }
      if (config.rotationIntervalSeconds) {
        rotationInterval = config.rotationIntervalSeconds;
      }
    } catch (e) {
      console.error('Error reading config.json:', e.message);
    }
  }

  // Calculate which file to show based on current timestamp
  // We use Math.floor(Date.now() / 1000 / interval) % count
  const nowSeconds = Math.floor(Date.now() / 1000);
  // Debug: check for hidden characters
  console.log(`[DEBUG] Config file: "${currentFileName}"`);
  console.log(`[DEBUG] Config file hex:`, Buffer.from(currentFileName).toString('hex'));

  const infoPath = path.resolve(__dirname, currentFileName);
  console.log(`[DEBUG] Resolved Path: "${infoPath}"`);

  if (!fs.existsSync(infoPath)) {
    console.error(`[ERROR] File DOES NOT EXIST at: "${infoPath}"`);
    // List directory to see what IS there
    try {
      const dirFiles = fs.readdirSync(__dirname);
      console.log(`[DEBUG] Directory listing:`, dirFiles);
      const match = dirFiles.find(f => f === currentFileName);
      console.log(`[DEBUG] Found in dir? ${match ? 'YES' : 'NO'}`);
      if (match) {
        console.log(`[DEBUG] Dir file hex:`, Buffer.from(match).toString('hex'));
      }
    } catch (e) {
      console.error('[DEBUG] Failed to list directory:', e);
    }
    return res.status(404).send(`# File not found: ${currentFileName}\n\nCheck your \`config.json\`.`);
  }

  // Send the file content + a header telling frontend when to refresh next
  // (optional, but good for keeping sync)
  res.set('X-Rotation-Interval', rotationInterval);
  res.type('text/plain').send(fs.readFileSync(infoPath, 'utf8'));
});

// API endpoint
app.get('/api/teams', async (req, res) => {
  const now = Date.now();

  if (cache && now - cacheTime < CACHE_TTL_MS) {
    console.log(`[cache hit] Serving cached data (${Math.round((CACHE_TTL_MS - (now - cacheTime)) / 1000)}s left)`);
    return res.json({ teams: cache, updatedAt: new Date(cacheTime).toISOString(), cached: true });
  }

  console.log(`\n[${new Date().toLocaleTimeString()}] Fetching fresh data from GitHub...`);

  try {
    const teams = await fetchTeamData();
    cache = teams;
    cacheTime = Date.now();
    console.log(`  ✅ Done. ${teams.length} teams fetched.\n`);
    res.json({ teams, updatedAt: new Date(cacheTime).toISOString(), cached: false });
  } catch (err) {
    console.error('  ❌ Error fetching data:', err.message);
    // Return stale cache if available rather than a hard error
    if (cache) {
      return res.json({ teams: cache, updatedAt: new Date(cacheTime).toISOString(), cached: true, stale: true });
    }
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀  Hackathon Dashboard running at http://localhost:${PORT}`);
  console.log(`    Org: ${GITHUB_ORG}`);
  console.log(`    Open the URL above in your browser.\n`);
});
