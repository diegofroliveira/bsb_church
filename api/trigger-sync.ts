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
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow_id}/runs?per_page=10`, {
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
      if (!data.workflow_runs) {
        return res.status(200).json({ runs: [] });
      }

      // Mapeia as 10 execuções mais recentes
      const runs = data.workflow_runs.map((run: any) => ({
        id: run.id,
        status: run.status,
        conclusion: run.conclusion,
        event: run.event, // 'schedule' ou 'workflow_dispatch'
        created_at: run.created_at,
        updated_at: run.updated_at
      }));

      return res.status(200).json({ runs });
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
