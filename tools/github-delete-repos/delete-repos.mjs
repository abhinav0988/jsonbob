import "dotenv/config";
import axios from "axios";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const GITHUB_USERNAME = process.env.GITHUB_USERNAME?.trim();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN?.trim();
const KEEP_REPO = process.env.KEEP_REPO?.trim();

function fail(message) {
  console.error(`\nError: ${message}`);
  process.exit(1);
}

if (!GITHUB_USERNAME || !GITHUB_TOKEN || !KEEP_REPO) {
  fail(
    "Missing required env vars. Set GITHUB_USERNAME, GITHUB_TOKEN, and KEEP_REPO in a .env file (see .env.example).",
  );
}

const api = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": `${GITHUB_USERNAME}-repo-cleaner`,
  },
  validateStatus: () => true,
});

/**
 * Fetch every repository owned by the authenticated user (paginated).
 * @returns {Promise<Array<{ name: string, full_name: string, private: boolean, html_url: string }>>}
 */
async function fetchOwnedRepositories() {
  const repos = [];
  let page = 1;
  const perPage = 100;

  for (;;) {
    const res = await api.get("/user/repos", {
      params: {
        affiliation: "owner",
        per_page: perPage,
        page,
        sort: "full_name",
        direction: "asc",
      },
    });

    if (res.status === 401) {
      fail("GitHub authentication failed. Check GITHUB_TOKEN (needs delete_repo + repo scopes).");
    }
    if (res.status >= 400) {
      fail(`Failed to list repositories (HTTP ${res.status}): ${JSON.stringify(res.data)}`);
    }

    const batch = Array.isArray(res.data) ? res.data : [];
    // Only keep repos owned by this username (safety against org noise).
    for (const repo of batch) {
      if (repo?.owner?.login?.toLowerCase() === GITHUB_USERNAME.toLowerCase()) {
        repos.push({
          name: repo.name,
          full_name: repo.full_name,
          private: Boolean(repo.private),
          html_url: repo.html_url,
        });
      }
    }

    if (batch.length < perPage) break;
    page += 1;
  }

  return repos;
}

async function deleteRepository(fullName) {
  const res = await api.delete(`/repos/${fullName}`);
  if (res.status === 204) {
    return { ok: true };
  }
  return {
    ok: false,
    status: res.status,
    message: res.data?.message || JSON.stringify(res.data),
  };
}

async function confirmDeletion() {
  const rl = readline.createInterface({ input, output });
  try {
    console.log('\nType exactly "DELETE ALL" to confirm permanent deletion.');
    const answer = (await rl.question("> ")).trim();
    return answer === "DELETE ALL";
  } finally {
    rl.close();
  }
}

async function main() {
  console.log("GitHub repository cleaner");
  console.log("=========================");
  console.log(`User: ${GITHUB_USERNAME}`);
  console.log(`Keep: ${KEEP_REPO}`);
  console.log("Fetching owned repositories…\n");

  const owned = await fetchOwnedRepositories();
  const keep = owned.find((r) => r.name === KEEP_REPO);
  const toDelete = owned.filter((r) => r.name !== KEEP_REPO);

  if (!keep) {
    console.warn(
      `Warning: KEEP_REPO "${KEEP_REPO}" was not found among owned repositories.`,
    );
    console.warn("No repository will be protected by name match.\n");
  } else {
    console.log("Repository to keep:");
    console.log(`  - ${keep.full_name} (${keep.private ? "private" : "public"})`);
    console.log(`    ${keep.html_url}\n`);
  }

  console.log(`Repositories to delete (${toDelete.length}):`);
  if (toDelete.length === 0) {
    console.log("  (none)");
    console.log("\nNothing to delete. Exiting.");
    return;
  }
  for (const repo of toDelete) {
    console.log(`  - ${repo.full_name} (${repo.private ? "private" : "public"})`);
  }

  const confirmed = await confirmDeletion();
  if (!confirmed) {
    console.log("\nConfirmation failed. Aborted — no repositories were deleted.");
    process.exit(0);
  }

  console.log("\nDeleting…\n");
  let deleted = 0;
  let failed = 0;
  const failures = [];

  for (let i = 0; i < toDelete.length; i += 1) {
    const repo = toDelete[i];
    const n = i + 1;
    process.stdout.write(`[${n}/${toDelete.length}] Deleting ${repo.full_name}… `);

    try {
      const result = await deleteRepository(repo.full_name);
      if (result.ok) {
        console.log("OK");
        deleted += 1;
      } else {
        console.log(`FAILED (HTTP ${result.status}: ${result.message})`);
        failed += 1;
        failures.push({ repo: repo.full_name, ...result });
      }
    } catch (err) {
      console.log(`FAILED (${err.message})`);
      failed += 1;
      failures.push({ repo: repo.full_name, message: err.message });
    }
  }

  console.log("\n======== Summary ========");
  console.log(`Kept:    ${KEEP_REPO}${keep ? "" : " (not found)"}`);
  console.log(`Deleted: ${deleted}`);
  console.log(`Failed:  ${failed}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) {
      console.log(`  - ${f.repo}: ${f.message || f.status}`);
    }
  }
  console.log("=========================\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
