import { execSync } from 'child_process'
import { existsSync, rmSync, renameSync } from 'fs'

const DIST = 'dist'

if (existsSync(DIST)) {
  try {
    rmSync(DIST, { recursive: true, force: true })
  } catch {
    try {
      const fallback = `${DIST}_${Date.now()}`
      renameSync(DIST, fallback)
    } catch {
      process.env.VITE_OUT_DIR = `${DIST}_${Date.now()}`
      console.warn(`[build] ${DIST} locked, using ${process.env.VITE_OUT_DIR}`)
    }
  }
}

execSync('vite build', { stdio: 'inherit', env: process.env })
