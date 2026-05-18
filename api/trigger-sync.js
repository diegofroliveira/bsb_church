const https = require('https');

module.exports = async (req, res) => {
  // CORS Headers
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

  const pat = process.env.GITHUB_PAT;
  if (!pat) {
    return res.status(500).json({ error: 'GITHUB_PAT environment variable is not configured' });
  }

  const options = {
    hostname: 'api.github.com',
    path: '/repos/diegofroliveira/bsb_church/actions/workflows/268386022/dispatches',
    method: 'POST',
    headers: {
      'User-Agent': 'bsb-church-app',
      'Authorization': `token ${pat}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    }
  };

  const postData = JSON.stringify({
    ref: 'main'
  });

  const request = https.request(options, (response) => {
    let data = '';
    response.on('data', (chunk) => { data += chunk; });
    response.on('end', () => {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return res.status(200).json({ success: true, message: 'Workflow triggered successfully' });
      } else {
        return res.status(response.statusCode).json({ error: `GitHub API returned status ${response.statusCode}: ${data}` });
      }
    });
  });

  request.on('error', (error) => {
    return res.status(500).json({ error: `Internal request error: ${error.message}` });
  });

  request.write(postData);
  request.end();
};
