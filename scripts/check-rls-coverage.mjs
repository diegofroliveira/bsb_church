import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationsDirectory = join(process.cwd(), 'supabase', 'migrations')
const files = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()

const sql = files
  .map((file) => readFileSync(join(migrationsDirectory, file), 'utf8'))
  .join('\n')

const tables = new Set(
  [...sql.matchAll(/create\s+table\s+public\.([a-z][a-z0-9_]*)/gi)]
    .map((match) => match[1].toLowerCase()),
)

const violations = []

for (const table of tables) {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const enabled = new RegExp(
    `alter\\s+table\\s+public\\.${escaped}\\s+enable\\s+row\\s+level\\s+security`,
    'i',
  ).test(sql)
  const forced = new RegExp(
    `alter\\s+table\\s+public\\.${escaped}\\s+force\\s+row\\s+level\\s+security`,
    'i',
  ).test(sql)

  if (!enabled || !forced) {
    violations.push(`${table}: RLS enabled=${enabled}, forced=${forced}`)
  }
}

if (/grant\s+[^;]+\s+to\s+anon\b/i.test(sql)) {
  violations.push('uma migration concede privilégios diretamente ao papel anon')
}

if (violations.length > 0) {
  console.error('Cobertura RLS inválida:')
  violations.forEach((violation) => console.error(`- ${violation}`))
  process.exit(1)
}

console.log(`Cobertura RLS verificada em ${tables.size} tabelas.`)
