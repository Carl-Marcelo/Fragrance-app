import { handleDiscover } from '../_lib/discover'

// GET /api/discover/brand?name=<brand>
export function GET(request: Request) {
  return handleDiscover(request, 'brand')
}
