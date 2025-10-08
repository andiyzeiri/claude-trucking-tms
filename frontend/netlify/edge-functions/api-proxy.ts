export default async (request: Request) => {
  const url = new URL(request.url)

  // Replace /api with CloudFront URL
  const backendUrl = url.pathname.replace('/api', 'https://d353mi06zxxkvl.cloudfront.net/api')
  const backendUrlWithQuery = backendUrl + url.search

  // Clone headers and ensure Authorization is included
  const headers = new Headers(request.headers)

  // Forward the request to CloudFront
  const response = await fetch(backendUrlWithQuery, {
    method: request.method,
    headers: headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.blob() : undefined,
  })

  // Clone response headers
  const responseHeaders = new Headers(response.headers)

  // Return the response
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

export const config = { path: "/api/*" }
