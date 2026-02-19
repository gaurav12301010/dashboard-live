
### 📌 Prompt for Antigravity Agent

> Build a **local-only hackathon dashboard website**.
>
> **Context**
>
> * We are hosting a hackathon.
> * Each team has **one GitHub repository**.
> * All repositories belong to **one GitHub organization**.
> * The dashboard will be displayed on a **large screen**.
>
> **Requirements**
>
> * Backend:
>
>   * Use **Node.js** with a simple server (Express is fine).
>   * Fetch data from the **GitHub REST API**.
>   * Authenticate using a **GitHub Personal Access Token**.
>   * For each repository in the organization:
>
>     * Treat repo name as the **team name**.
>     * Fetch and count **total commits**.
>   * Expose a JSON API endpoint like `/api/teams`.
> * Frontend:
>
>   * Simple **HTML + JavaScript** (no heavy frameworks).
>   * Display:
>
>     * Team name
>     * Number of commits
>   * Show data as a **bar chart**.
>   * Auto-refresh every **60 seconds**.
>   * Dark theme, readable from a distance.
> * General:
>
>   * Dashboard must run **locally on a PC**.
>   * No deployment or cloud services.
>   * Code should be easy to modify during the hackathon.
>
> **Output**
>
> * Provide:
>
>   * Backend code
>   * Frontend code
>   * Clear setup and run instructions

---

