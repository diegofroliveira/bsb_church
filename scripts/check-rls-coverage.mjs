import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationsDirectory = join(process.cwd(), 'supabase', 'migrations')
const files = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()

const sql = files
  .map((file) => readFileSync(join(migrationsDirectory, file), 'utf8'))
  .join('\n')

// Comentários não podem satisfazer os controles estáticos.
const executableSql = sql
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/--[^\r\n]*/g, '')

const tables = new Set(
  [
    ...executableSql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z][a-z0-9_]*)/gi,
    ),
  ].map((match) => match[1].toLowerCase()),
)

const violations = []

for (const table of tables) {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const stateChanges = new RegExp(
    `alter\\s+table\\s+public\\.${escaped}\\s+` +
      '(enable|disable|force|no\\s+force)\\s+row\\s+level\\s+security',
    'gi',
  )

  let enabled = false
  let forced = false
  let stateChange

  while ((stateChange = stateChanges.exec(executableSql)) !== null) {
    const operation = stateChange[1].replace(/\s+/g, ' ').toLowerCase()
    if (operation === 'enable') enabled = true
    if (operation === 'disable') enabled = false
    if (operation === 'force') forced = true
    if (operation === 'no force') forced = false
  }

  const hasPolicy = new RegExp(
    `create\\s+policy\\s+[^;]+?\\s+on\\s+public\\.${escaped}\\b`,
    'i',
  ).test(executableSql)

  if (!enabled || !forced || !hasPolicy) {
    violations.push(
      `${table}: RLS enabled=${enabled}, forced=${forced}, policy=${hasPolicy}`,
    )
  }
}

if (/grant\s+[^;]+\s+to\s+anon\b/i.test(executableSql)) {
  violations.push('uma migration concede privilégios diretamente ao papel anon')
}

if (violations.length > 0) {
  console.error('Cobertura RLS inválida:')
  violations.forEach((violation) => console.error(`- ${violation}`))
  process.exit(1)
}

console.log(`Cobertura RLS verificada em ${tables.size} tabelas.`)
