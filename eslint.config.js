import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'temp_restore/**',
    'LAB/**',
    'node_modules_old/**',
    'node_modules_to_delete_20260520/**',
    'node_modules_to_delete_20260522/**',
    'node_modules_incomplete_20260423_152303/**',
    'node_modules_broken_20260423_151441/**',
    'check_columns.cjs',
    'check_db.cjs',
    'clean_deploy.cjs',
    'extract_casais.cjs',
    'fix.cjs',
    'fix_reports_sort.cjs',
    'fix_vercel.cjs',
    'query_profiles.cjs',
    'test_membros.cjs'
  ]),
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: globals.browser,
    },
    rules: {
      'no-redeclare': 'off',
      'no-shadow': 'off',
      'no-undef': 'off',
      'prefer-const': 'off',
      'no-empty': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/static-components': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
])

