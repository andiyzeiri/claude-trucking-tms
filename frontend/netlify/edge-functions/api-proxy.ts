export default async (request: Request) => {
  const url = new URL(request.url)

  // Replace /api with CloudFront URL
  const backendUrl = url.pathname.replace('/api', 'https://d353mi06zxxkvl.cloudfront.net/api')
  const backendUrlWithQuery = backendUrl + url.search

  // Forward the request to CloudFront
  const response = await fetch(backendUrlWithQuery, {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined,
  })

  // Return the response
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

export const config = { path: "/api/*" }
