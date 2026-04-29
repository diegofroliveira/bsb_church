import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const owner = 'diegofroliveira';
  const repo = 'bsb_church';
  const workflow_id = 'sync_prover.yml'; // Nome do arquivo .yml
  const ref = 'main'; // Usar a branch principal

  const GITHUB_PAT = process.env.GITHUB_PAT;
  if (!GITHUB_PAT) {
    return res.status(500).json({ error: 'GITHUB_PAT não está configurado.' });
  }

  // Se for GET, busca o status das execuções
  if (req.method === 'GET') {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow_id}/runs`, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${GITHUB_PAT}`,
        }
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Falha ao buscar status do GitHub Actions' });
      }

      const data = await response.json();
      if (!data.workflow_runs || data.workflow_runs.length === 0) {
        return res.status(200).json({ status: 'none', conclusion: null, updated_at: null });
      }

      // Pega a execução mais recente
      const latestRun = data.workflow_runs[0];
      return res.status(200).json({
        status: latestRun.status, // e.g. completed, in_progress, queued
        conclusion: latestRun.conclusion, // e.g. success, failure, null
        updated_at: latestRun.updated_at
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao buscar status no GitHub' });
    }
  }

  // Apenas aceitar POST e GET
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: ref
      })
    });

    if (response.ok) {
      return res.status(200).json({ message: 'Sincronização iniciada com sucesso na Nuvem!' });
    } else {
      const errorData = await response.json();
      return res.status(response.status).json({ error: 'Falha ao acionar o GitHub Actions', details: errorData });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro interno no servidor Vercel' });
  }
}
