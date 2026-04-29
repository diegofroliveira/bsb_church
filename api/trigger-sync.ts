import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apenas aceitar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Pegar o token de acesso pessoal (PAT) configurado na Vercel
  const GITHUB_PAT = process.env.GITHUB_PAT;
  
  if (!GITHUB_PAT) {
    return res.status(500).json({ error: 'GITHUB_PAT não está configurado nas variáveis de ambiente da Vercel.' });
  }

  const owner = 'diegofroliveira';
  const repo = 'bsb_church';
  const workflow_id = 'sync_prover.yml'; // Nome do arquivo .yml
  const ref = 'feature/ai-features'; // Branch onde está a automação (ou 'main' se você já fez o merge)

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
