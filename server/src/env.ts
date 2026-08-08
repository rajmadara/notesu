import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Minimal .env loader (no dependency): reads server/.env if present and
// fills in any variables not already set in the environment.
export function loadEnv(): void {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const envPath = path.join(__dirname, '../.env')
  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}
