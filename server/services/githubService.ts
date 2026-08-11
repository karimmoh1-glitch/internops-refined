import { Octokit } from "@octokit/rest";

interface GitHubRepoInfo {
  owner: string;
  repo: string;
}

export function parseGithubUrl(url: string): GitHubRepoInfo | null {
  try {
    // Handle formats: https://github.com/owner/repo, github.com/owner/repo, owner/repo
    let cleanUrl = url.trim().replace(/\.git$/, "").replace(/\/$/, "");

    // Direct owner/repo format
    const directMatch = cleanUrl.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
    if (directMatch) {
      return { owner: directMatch[1], repo: directMatch[2] };
    }

    // URL format
    const urlMatch = cleanUrl.match(/(?:https?:\/\/)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
    if (urlMatch) {
      return { owner: urlMatch[1], repo: urlMatch[2] };
    }

    return null;
  } catch {
    return null;
  }
}

export async function validateRepo(token: string, owner: string, repo: string): Promise<boolean> {
  try {
    const octokit = new Octokit({ auth: token });
    await octokit.repos.get({ owner, repo });
    return true;
  } catch {
    return false;
  }
}

export async function getRecentCommits(
  token: string,
  owner: string,
  repo: string,
  limit: number = 10
): Promise<any[]> {
  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.repos.listCommits({
      owner,
      repo,
      per_page: limit,
    });

    return data.map((commit) => ({
      sha: commit.sha.substring(0, 7),
      fullSha: commit.sha,
      message: commit.commit.message.split("\n")[0],
      author: commit.commit.author?.name || commit.author?.login || "Unknown",
      date: commit.commit.author?.date || "",
      url: commit.html_url,
    }));
  } catch (err: any) {
    console.error(`[GitHub] Failed to fetch commits: ${err.message}`);
    return [];
  }
}

export async function getRecentPullRequests(
  token: string,
  owner: string,
  repo: string,
  limit: number = 10
): Promise<any[]> {
  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.pulls.list({
      owner,
      repo,
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: limit,
    });

    return data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      merged: pr.merged_at !== null,
      author: pr.user?.login || "Unknown",
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      url: pr.html_url,
    }));
  } catch (err: any) {
    console.error(`[GitHub] Failed to fetch PRs: ${err.message}`);
    return [];
  }
}
