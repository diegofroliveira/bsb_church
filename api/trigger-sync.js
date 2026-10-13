import { handleApiError, requireSyncAccess, sendJson, readJson } from './_admin-auth.js';
import {
  getSyncLogs,
  calculateQuota,
  recordSyncLog,
  resetSecretariaLogs,
  MAX_SYNC_PER_DAY,
  MAX_SYNC_PER_WEEK
} from './_sync-tracker.js';

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
  // Configuração de CORS para suportar chamadas locais e na Vercel
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // 1. GET: Retorna status atual de cotas e permissões
  if (req.method === 'GET') {
    try {
      const auth = await requireSyncAccess(req);
      const logs = await getSyncLogs(auth.supabase);
      const quota = calculateQuota(logs, auth.role);

      return sendJson(res, 200, {
        success: true,
        role: auth.role,
        isAdmin: auth.isAdmin,
        isSecretaria: auth.isSecretaria,
        quota,
        recentLogs: logs.slice(0, 10)
      });
    } catch (error) {
      return handleApiError(res, error);
    }
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Método não permitido.' });
  }

  let auth;
  try {
    auth = await requireSyncAccess(req);
  } catch (error) {
    return handleApiError(res, error);
  }

  const body = await readJson(req);

  // Ação opcional: Administrador resetando cotas da secretaria
  if (body?.action === 'reset_secretaria_quota') {
    if (!auth.isAdmin) {
      return sendJson(res, 403, { error: 'Apenas administradores podem resetar limites de sincronização.' });
    }
    await resetSecretariaLogs(auth.supabase);
    const quota = calculateQuota([], 'secretaria');
    return sendJson(res, 200, {
      success: true,
      message: 'Limites da secretaria resetados com sucesso!',
      quota
    });
  }

  // Verificação de cota para perfil Secretaria
  const currentLogs = await getSyncLogs(auth.supabase);
  const currentQuota = calculateQuota(currentLogs, auth.role);

  if (auth.isSecretaria && !currentQuota.canSync) {
    const detailMsg = currentQuota.blockedReason ||
      `Você atingiu o limite de atualizações da secretaria (máx. ${MAX_SYNC_PER_DAY} por dia e ${MAX_SYNC_PER_WEEK} por semana).`;
    return sendJson(res, 429, {
      error: `${detailMsg} Entre em contato com o administrador caso necessite de uma atualização emergencial adicional.`,
      quota: currentQuota
    });
  }

  const token = getGithubToken();
  if (!token) {
    return sendJson(res, 500, {
      error: 'Nenhum token do GitHub configurado. Configure GITHUB_PAT, GITHUB_TOKEN ou GH_TOKEN na Vercel.',
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
      return sendJson(res, response.status, {
        error: buildGithubError(response.status, text || 'Empty response body'),
        githubStatus: response.status,
        githubResponse: payload,
      });
    }

    // Sucesso: registrar evento de sincronização
    const logEntry = {
      user_id: auth.user.id,
      user_name: auth.profile?.name || auth.user.user_metadata?.name || auth.user.email?.split('@')[0] || 'Usuário',
      user_email: auth.user.email,
      role: auth.role,
      status: 'success',
      created_at: new Date().toISOString()
    };

    await recordSyncLog(auth.supabase, logEntry);

    const updatedLogs = [logEntry, ...currentLogs];
    const updatedQuota = calculateQuota(updatedLogs, auth.role);

    return sendJson(res, 200, {
      success: true,
      message: 'Sincronização iniciada com sucesso! O robô do Prover está executando no GitHub Actions e atualizará o Supabase em breve.',
      quota: updatedQuota,
      githubStatus: response.status,
      githubResponse: payload,
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: `Erro interno ao solicitar execução no GitHub: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
    });
  }
}
