import { NextResponse } from 'next/server';

/**
 * Middleware function for Next.js
 * Adds security headers and handles routing logic
 */
export function middleware(request) {
  // Get the pathname from the URL
  const { pathname } = request.nextUrl;
  
  // Create a new response
  const response = NextResponse.next();
  
  // Add security headers to all responses
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=()');  
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'); // 2 years HSTS
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('X-Download-Options', 'noopen');
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  
  // Set strict Content Security Policy for admin routes
  if (pathname.startsWith('/admin')) {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " + // Unsafe-inline needed for Next.js
      "style-src 'self' 'unsafe-inline'; " + // Unsafe-inline needed for styled-components
      "img-src 'self' data: blob:; " +
      "font-src 'self'; " +
      "connect-src 'self' https://api.secura.com; " +
      "frame-src 'none'; " +
      "object-src 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self'; " +
      "frame-ancestors 'none'; " +
      "block-all-mixed-content; " +
      "upgrade-insecure-requests;"
    );
  } else {
    // Set less strict CSP for regular routes - allow connections to backend during development
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; " +
      "font-src 'self'; " +
      "connect-src 'self' http://localhost:5000 http://127.0.0.1:5000 https://api.secura.com; " +
      "frame-src 'self'; " +
      "object-src 'none'; " +
      "base-uri 'self';"
    );
  }
  
  // Add CSRF protection
  response.headers.set('X-CSRF-Protection', '1; mode=block');
  
  // Redirect to login page if trying to access protected routes without authentication
  if (pathname.startsWith('/admin') || pathname.startsWith('/dashboard')) {
    // Check for authentication token
    const authToken = request.cookies.get('authToken')?.value;
    
    if (!authToken) {
      // Redirect to login page
      const url = new URL('/login', request.url);
      url.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(url);
    }
  }
  
  // Note: We can't check navigator.onLine in middleware (server-side)
  // Offline detection should be handled client-side instead
  
  return response;
}

/**
 * Configure which paths should be processed by this middleware
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
