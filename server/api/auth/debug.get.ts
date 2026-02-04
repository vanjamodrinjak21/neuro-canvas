// Debug endpoint to check auth cookies and headers
export default defineEventHandler((event) => {
  const cookies = parseCookies(event)
  const headers = getHeaders(event)

  console.log('[Auth Debug] All cookies:', cookies)
  console.log('[Auth Debug] Cookie header:', headers.cookie)
  console.log('[Auth Debug] All headers:', JSON.stringify(headers, null, 2))

  // Check for auth-related cookies
  const authCookies = Object.entries(cookies).filter(([key]) =>
    key.includes('next-auth') || key.includes('__Secure') || key.includes('__Host')
  )

  return {
    timestamp: new Date().toISOString(),
    cookies: {
      all: Object.keys(cookies),
      authRelated: Object.fromEntries(authCookies),
      count: Object.keys(cookies).length
    },
    headers: {
      host: headers.host,
      origin: headers.origin,
      referer: headers.referer,
      'x-forwarded-proto': headers['x-forwarded-proto'],
      'x-forwarded-host': headers['x-forwarded-host'],
      'x-forwarded-for': headers['x-forwarded-for']
    },
    env: {
      NODE_ENV: process.env.NODE_ENV,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      AUTH_ORIGIN: process.env.AUTH_ORIGIN
    }
  }
})
