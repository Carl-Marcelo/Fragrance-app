import { handleDiscover } from '../_lib/discover'

// GET /api/discover/similar?name=<fragrance name>
export function GET(request: Request) {
  return handleDiscover(request, 'similar')
}
