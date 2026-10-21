import { handleDiscover } from '../_lib/discover'

// GET /api/discover/search?q=<text>&gender=men|women|unisex&page=1|2
export function GET(request: Request) {
  return handleDiscover(request, 'search')
}
