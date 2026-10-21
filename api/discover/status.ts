// GET /api/discover/status: whether live discovery is available. Never calls the
// fragrance database, so it costs nothing.
export function GET() {
  const has = (name: string) => Boolean(process.env[name]?.trim())
  const configured = has('FRAGELLA_API_KEY')
  const limitsShared = (has('SUPABASE_URL') || has('VITE_SUPABASE_URL')) && has('SUPABASE_SERVICE_ROLE_KEY')
  const production = has('VERCEL') && process.env.VERCEL_ENV !== 'development'
  return new Response(
    JSON.stringify({
      available: configured && (limitsShared || !production),
      configured,
      limitsShared,
      source: 'fragella',
    }),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=60, s-maxage=300',
      },
    },
  )
}
