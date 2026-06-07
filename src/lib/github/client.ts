const GITHUB_API = "https://api.github.com";

export class GithubApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function githubFetch(
  path: string,
  token: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers || {}),
    },
  });
}

export type GithubRepo = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  default_branch: string;
  private: boolean;
};

export type GithubContent = {
  path: string;
  sha: string;
  content?: string;
  encoding?: string;
  type: "file" | "dir";
};

export async function listUserRepos(token: string): Promise<GithubRepo[]> {
  const res = await githubFetch(
    "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
    token
  );
  if (!res.ok) throw new GithubApiError(await res.text(), res.status);
  return res.json();
}

export async function getRepo(
  token: string,
  owner: string,
  repo: string
): Promise<GithubRepo> {
  const res = await githubFetch(`/repos/${owner}/${repo}`, token);
  if (!res.ok) throw new GithubApiError(await res.text(), res.status);
  return res.json();
}

export async function getFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<{ content: string; sha: string } | null> {
  const res = await githubFetch(
    `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
    token
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new GithubApiError(await res.text(), res.status);
  const data: GithubContent = await res.json();
  if (data.type !== "file" || !data.content) return null;
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return { content, sha: data.sha };
}

export async function putFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string,
  content: string,
  message: string,
  sha?: string
): Promise<string> {
  const body: Record<string, string> = {
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;

  const res = await githubFetch(
    `/repos/${owner}/${repo}/contents/${path}`,
    token,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new GithubApiError(await res.text(), res.status);
  const data = await res.json();
  return data.commit?.sha || "";
}

export async function getBranchSha(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<string> {
  const res = await githubFetch(
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    token
  );
  if (!res.ok) throw new GithubApiError(await res.text(), res.status);
  const data = await res.json();
  return data.object?.sha || "";
}
