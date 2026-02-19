# 🏆 Hackathon Live Dashboard

A **local-only** live commit leaderboard for your hackathon. Connects to a GitHub organization, counts commits per team repository, and displays a beautiful dark-theme bar chart on a big screen.

---

## Setup

### 1. Install Node.js
Download and install from https://nodejs.org (LTS version recommended).

### 2. Install dependencies
```bash
cd "path/to/dashboard live"
npm install
```

### 3. Configure GitHub credentials
```bash
# Copy the example file
copy .env.example .env
```

Then open `.env` in any text editor and fill in your values:

```env
GITHUB_TOKEN=ghp_your_personal_access_token_here
GITHUB_ORG=your-github-organization-name
PORT=3000
```

**How to create a GitHub Personal Access Token (PAT):**
1. Go to https://github.com/settings/tokens → **Generate new token (classic)**
2. Set an expiry (e.g. 1 day for the hackathon)
3. Select scope: ✅ `repo` (or just `public_repo` if all repos are public)
4. Copy the token into `.env`

### 4. Start the server
```bash
npm start
```

You should see:
```
🚀  Hackathon Dashboard running at http://localhost:3000
    Org: your-github-organization-name
```

### 5. Open the dashboard
Navigate to **http://localhost:3000** in your browser.  
For fullscreen on Windows: press **F11**.

---

## How it works

| Layer | Tech | Details |
|---|---|---|
| Backend | Node.js + Express | Serves the API + static files |
| GitHub data | GitHub REST API v3 | Lists org repos, counts commits via Link-header trick |
| Cache | In-memory | 55-second TTL to stay within API rate limits |
| Frontend | HTML + CSS + JS | Auto-refreshes every 60 seconds |

### Commit counting trick
Instead of paginating all commits, the server calls:
```
GET /repos/{org}/{repo}/commits?per_page=1
```
The response's `Link` header contains the **last page number**, which equals the total commit count. This is one API request per repository — fast and rate-limit-friendly.

---

## Customization

| What | Where | How |
|---|---|---|
| Refresh interval | `public/index.html` | Change `REFRESH_INTERVAL = 60` |
| Dashboard title | `public/index.html` | Edit the `<h1>` text |
| Server port | `.env` | Change `PORT=3000` |
| Bar colors | `public/index.html` | Edit `.rank-*-bar` CSS classes |
| Concurrency | `server.js` | Change `const CONCURRENCY = 5` |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Missing GITHUB_TOKEN or GITHUB_ORG` | Ensure `.env` file exists and has both values |
| `0 commits` for all repos | Check PAT has `repo` scope and org name is correct |
| No repos listed | Ensure PAT has access to the organization's repos |
| Page not loading | Make sure `npm start` is running and visit `http://localhost:3000` |
