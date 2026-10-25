export const SECURITY_HEADERS = Object.freeze({
  "strict-transport-security": "max-age=31536000",
  "content-security-policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; frame-src 'self' blob: https:; form-action 'self'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https:; worker-src 'self' blob:",
  "x-frame-options": "SAMEORIGIN",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()"
});
