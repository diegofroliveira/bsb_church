import { readFileSync, statSync } from 'node:fs'
import { extname } from 'node:path'
import { spawnSync } from 'node:child_process'

const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024
const TEXT_EXTENSIONS = new Set([
  '', '.cjs', '.css', '.env', '.example', '.html', '.ini', '.js', '.json',
  '.jsx', '.md', '.mjs', '.properties', '.py', '.sh', '.sql', '.toml',
  '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml',
])

const forbiddenPaths = [
  {
    name: 'arquivo de ambiente versionado',
    matches: (path) => /(^|\/)\.env(?:\..+)?$/i.test(path) && path !== '.env.example',
  },
  {
    name: 'exportação de dados versionada',
    matches: (path) => /^dados_exportados(\/|$)/i.test(path),
  },
  {
    name: 'diagnóstico de sincronização versionado',
    matches: (path) => /(^|\/)sync_diagnostics(\/|$)/i.test(path),
  },
  {
    name: 'cache Python versionado',
    matches: (path) => /(^|\/)__pycache__(\/|$)|\.py[co]$/i.test(path),
  },
  {
    name: 'arquivo temporário ou de restauração versionado',
    matches: (path) => /(^|\/)(temp_restore|tmp)(\/|$)/i.test(path),
  },
  {
    name: 'chave privada ou banco local versionado',
    matches: (path) => /\.(?:key|p12|pfx|pem|sqlite3?|db|dump)$/i.test(path),
  },
]

const secretPatterns = [
  { name: 'chave privada', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'token GitHub', regex: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g },
  { name: 'access key AWS', regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { name: 'token Slack', regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { name: 'service role Supabase em JWT', regex: /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl[A-Za-z0-9_-]*\.[A-Za-z0-9_-]{20,}/g },
  {
    name: 'senha ou segredo literal',
    regex: /\b(?:password|passwd|pwd|senha|secret|service[_-]?role[_-]?key)\b\s*[:=]\s*["'](?!\s*(?:|changeme|example|exemplo|placeholder|senha_segura|sua[-_ ]?senha|your[-_ ]?password)\s*["'])[^\n\r"']{4,}["']/gi,
  },
]

function trackedFiles() {
  const result = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  if (result.status !== 0) {
    const reason = result.stderr?.trim() || 'git ls-files falhou'
    throw new Error('Não foi possível listar os arquivos versionados: ' + reason)
  }
  return result.stdout.split('\0').filter(Boolean).map((path) => path.replaceAll('\\', '/'))
}

function isTextCandidate(path) {
  return TEXT_EXTENSIONS.has(extname(path).toLowerCase())
}

function lineNumberAt(content, index) {
  let line = 1
  for (let position = 0; position < index; position += 1) {
    if (content.charCodeAt(position) === 10) line += 1
  }
  return line
}

const violations = []

for (const path of trackedFiles()) {
  let forbiddenPath = false
  for (const rule of forbiddenPaths) {
    if (rule.matches(path)) {
      violations.push({ path, rule: rule.name })
      forbiddenPath = true
    }
  }

  if (forbiddenPath) continue
  if (!isTextCandidate(path)) continue

  let size
  try {
    size = statSync(path).size
  } catch {
    violations.push({ path, rule: 'arquivo versionado não pôde ser lido' })
    continue
  }
  if (size > MAX_TEXT_FILE_BYTES) continue

  const content = readFileSync(path, 'utf8')
  if (content.includes('\0')) continue

  if (/^public\/data\//i.test(path) && content.trim() !== '[]') {
    violations.push({ path, rule: 'arquivo público de dados deve permanecer vazio' })
  }

  for (const pattern of secretPatterns) {
    pattern.regex.lastIndex = 0
    for (const match of content.matchAll(pattern.regex)) {
      violations.push({
        path,
        line: lineNumberAt(content, match.index ?? 0),
        rule: pattern.name,
      })
    }
  }
}

if (violations.length > 0) {
  console.error('Arquivos sensíveis ou possíveis segredos foram encontrados:')
  for (const violation of violations) {
    const location = violation.line ? violation.path + ':' + violation.line : violation.path
    console.error('- ' + location + ' — ' + violation.rule)
  }
  console.error('\nOs valores detectados foram omitidos. Remova-os do código corrente e rotacione qualquer credencial real.')
  process.exit(1)
}

console.log('Verificação concluída: nenhum arquivo sensível ou segredo conhecido foi detectado.')
