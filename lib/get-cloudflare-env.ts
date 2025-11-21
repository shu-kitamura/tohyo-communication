// Helper to get Cloudflare environment from Next.js request
import { NextRequest } from 'next/server';

export function getCloudflareEnv(request: NextRequest): CloudflareEnv | null {
  // In OpenNext Cloudflare, bindings are accessible through multiple paths
  
  // Try to get from request context (primary method for OpenNext Cloudflare)
  const requestContext = (request as any).ctx;
  if (requestContext && requestContext.cloudflare && requestContext.cloudflare.env) {
    return requestContext.cloudflare.env;
  }

  // Alternative: direct cloudflare property
  const cloudflareContext = (request as any).cloudflare;
  if (cloudflareContext && cloudflareContext.env) {
    return cloudflareContext.env;
  }

  return null;
}

export function isCloudflareEnvironment(request: NextRequest): boolean {
  return getCloudflareEnv(request) !== null;
}
