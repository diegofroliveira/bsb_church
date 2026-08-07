# Gestão e rotação de credenciais

## Classificação

São segredos: senhas, cookies, tokens pessoais, chaves privadas, SUPABASE_SERVICE_ROLE_KEY e credenciais do Prover.

A chave anônima do Supabase é pública por natureza, mas só pode ser segura quando RLS e permissões estiverem corretas. Ela não substitui controle de acesso.

## Armazenamento permitido

- Desenvolvimento: .env.local ignorado pelo Git ou variáveis temporárias da sessão.
- GitHub Actions: GitHub Actions Secrets.
- Vercel: variáveis protegidas do ambiente correto.
- Documentação e testes: nomes fictícios e placeholders.

Segredos nunca devem aparecer em código, URLs, screenshots, fixtures, logs, artefatos ou mensagens de erro.

## Rotação do Prover

1. Confirmar que o extrator lê PROVER_EMAIL e PROVER_PASSWORD do ambiente.
2. Alterar a senha no Prover pelo responsável autorizado.
3. Atualizar o secret do GitHub sem registrar o valor em issue ou PR.
4. Atualizar a variável local apenas quando a sincronização for necessária.
5. Disparar a sincronização manualmente e verificar somente metadados não sensíveis.
6. Revogar a senha anterior e registrar data, responsável e resultado, nunca o valor.

## Rotação Supabase

1. Identificar o tipo de chave e todos os consumidores.
2. Corrigir RLS antes de tratar uma chave anônima como barreira de segurança.
3. Rotacionar imediatamente qualquer service role exposta.
4. Atualizar primeiro os cofres dos ambientes autorizados.
5. Validar autenticação e funções administrativas em staging.
6. Revogar a chave anterior e monitorar falhas.

## Incidente de exposição

1. Tratar a credencial como comprometida.
2. Revogar ou rotacionar antes de limpar o código.
3. Preservar evidências sem copiar o segredo.
4. Buscar o segredo no histórico, branches, tags, artifacts e logs do CI.
5. Avaliar impacto nos dados e necessidade de comunicação conforme LGPD.
6. Aplicar o runbook de histórico Git somente após coordenação.
