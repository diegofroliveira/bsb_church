const GITHUB_API_VERSION = '2022-11-28';
const WORKFLOW_OWNER = 'diegofroliveira';
const WORKFLOW_REPO = 'bsb_church';
const WORKFLOW_ID = 'sync_prover.yml';

function getGithubToken() {
  const rawToken =
    process.env.GITHUB_PAT ||
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    '';

  return rawToken
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^(token|bearer)\s+/i, '');
}

function buildGithubError(status, bodyText) {
  if (status === 401) {
    return [
      'GitHub rejected the credentials configured in Vercel.',
      'Update GITHUB_PAT, GITHUB_TOKEN, or GH_TOKEN with a valid token.',
      'For a fine-grained token, grant Actions: write on diegofroliveira/bsb_church.',
      'For a classic token, ensure the repo scope is enabled.',
    ].join(' ');
  }

  if (status === 403) {
    return [
      'GitHub accepted the request but denied access.',
      'Check whether the token has permission to trigger workflows in diegofroliveira/bsb_church.',
      `GitHub response: ${bodyText}`,
    ].join(' ');
  }

  return `GitHub API returned status ${status}: ${bodyText}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getGithubToken();
  if (!token) {
    return res.status(500).json({
      error: 'No GitHub token is configured. Set GITHUB_PAT, GITHUB_TOKEN, or GH_TOKEN in Vercel.',
    });
  }

  const url = `https://api.github.com/repos/${WORKFLOW_OWNER}/${WORKFLOW_REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'bsb-church-app',
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    });

    const text = await response.text();
    let payload = {};

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: buildGithubError(response.status, text || 'Empty response body'),
        githubStatus: response.status,
        githubResponse: payload,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Workflow triggered successfully.',
      githubStatus: response.status,
      githubResponse: payload,
    });
  } catch (error) {
    return res.status(500).json({
      error: `Internal request error while calling GitHub: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}
