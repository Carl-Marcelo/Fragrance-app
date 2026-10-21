/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// `npm run preview` serves the same security headers as production (vercel.json),
// so the Content-Security-Policy can be tested locally against the built app.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[]
}
const productionHeaders = Object.fromEntries(
  vercel.headers.find((h) => h.source === '/(.*)')!.headers.map((h) => [h.key, h.value]),
)

/**
 * Serves the Vercel functions in api/ during `npm run dev`, so the fragrance
 * database works locally without the Vercel CLI. Handlers export GET(request).
 */
function localApi(): Plugin {
  return {
    name: 'sillage-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const url = new URL(req.url, 'http://localhost')
        if (!/^\/api\/[a-z0-9/-]+$/i.test(url.pathname) || url.pathname.includes('/_')) {
          res.statusCode = 404
          return res.end()
        }
        try {
          const mod = await server.ssrLoadModule(`${url.pathname}.ts`)
          const handler = mod[req.method ?? 'GET'] as ((r: Request) => Promise<Response>) | undefined
          if (!handler) {
            res.statusCode = 405
            return res.end()
          }
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
          headers.set('x-real-ip', req.socket.remoteAddress ?? '127.0.0.1')
          const response = await handler(new Request(url, { method: req.method, headers }))
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (e) {
          next(e)
        }
      })
    },
  }
}

// https://vite.dev/config/
// Variables this config copied from .env files. Kept on globalThis because the
// file is re-evaluated, in the same process, whenever Vite restarts after a .env edit.
const g = globalThis as typeof globalThis & { __sillageEnvFromFiles?: Set<string> }
const fromFiles = (g.__sillageEnvFromFiles ??= new Set<string>())

export default defineConfig(({ mode }) => {
  // Make server-only variables (FRAGELLA_API_KEY, SUPABASE_SERVICE_ROLE_KEY, …)
  // from .env / .env.local available to the local API. They are never bundled:
  // only VITE_-prefixed variables reach the browser.
  // Forget values copied on a previous load first: loadEnv lets process.env
  // override the files, so an edited .env would otherwise go stale.
  for (const k of fromFiles) delete process.env[k]
  fromFiles.clear()
  for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    if (process.env[k] !== undefined) continue // set by the shell: it wins
    process.env[k] = v
    fromFiles.add(k)
  }

  return {
    plugins: [react(), tailwindcss(), localApi()],
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 900,
    },
    preview: {
      headers: productionHeaders,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
    },
  }
})
