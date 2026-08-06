import { getAdminClient, getAnonClient, handleApiError, readJson, sendJson } from './_admin-auth.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildEmailHtml({ name, link }) {
  const greeting = name ? `Olá, ${String(name).split(' ')[0]}!` : 'Olá!';
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="color: #4f46e5; margin-bottom: 4px;">IgrejaPro</h2>
      <p>${greeting}</p>
      <p>Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para escolher uma nova senha:</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${link}" style="background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">
          Redefinir minha senha
        </a>
      </p>
      <p style="font-size: 13px; color: #6b7280;">Se você não pediu essa redefinição, pode ignorar este e-mail com segurança. Este link expira em pouco tempo.</p>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">Se o botão não funcionar, copie e cole este link no navegador:<br />${link}</p>
    </div>
  `;
}

async function sendViaResend({ apiKey, to, name, link }) {
  const from = process.env.RESEND_FROM_EMAIL || 'IgrejaPro <onboarding@resend.dev>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Redefinição de senha — IgrejaPro',
      html: buildEmailHtml({ name, link })
    })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw Object.assign(new Error(`Falha ao enviar e-mail de redefinição (Resend ${response.status}).`), { status: 502, detail: body.slice(0, 300) });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método não permitido.' });
  try {
    const { email, redirectTo } = await readJson(req);
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      throw Object.assign(new Error('Informe um e-mail válido.'), { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;

    // Sem provedor de e-mail próprio configurado: usa o fluxo nativo do Supabase
    // (depende da configuração de SMTP/URLs do projeto Supabase).
    if (!resendApiKey) {
      const anon = getAnonClient();
      const { error } = await anon.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectTo || undefined
      });
      if (error) throw error;
      return sendJson(res, 200, { success: true, delivery: 'supabase' });
    }

    // Com provedor próprio: gera o link de recuperação via Admin API do Supabase
    // e envia o e-mail nós mesmos, sem depender do SMTP do Supabase.
    const admin = getAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: cleanEmail,
      options: { redirectTo: redirectTo || undefined }
    });

    if (error) {
      // Nunca revela se o e-mail existe ou não na base.
      if (/not.*found|no.*user|does not exist/i.test(error.message || '')) {
        return sendJson(res, 200, { success: true, delivery: 'email' });
      }
      throw error;
    }

    const actionLink = data?.properties?.action_link;
    if (actionLink) {
      await sendViaResend({
        apiKey: resendApiKey,
        to: cleanEmail,
        name: data?.user?.user_metadata?.name,
        link: actionLink
      });
    }

    return sendJson(res, 200, { success: true, delivery: 'email' });
  } catch (error) {
    return handleApiError(res, error);
  }
}
