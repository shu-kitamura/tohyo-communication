// Helper to get Cloudflare environment from Next.js request
import { NextRequest } from 'next/server';

interface CloudflareContext {
  cloudflare?: {
    env?: CloudflareEnv;
  };
}

interface RequestWithContext extends NextRequest {
  ctx?: CloudflareContext;
  cloudflare?: {
    env?: CloudflareEnv;
  };
}

export function getCloudflareEnv(request: NextRequest): CloudflareEnv | null {
  // In OpenNext Cloudflare, bindings are accessible through multiple paths
  const requestWithContext = request as RequestWithContext;
  
  // Try to get from request context (primary method for OpenNext Cloudflare)
  const requestContext = requestWithContext.ctx;
  if (requestContext?.cloudflare?.env) {
    return requestContext.cloudflare.env;
  }

  // Alternative: direct cloudflare property
  const cloudflareContext = requestWithContext.cloudflare;
  if (cloudflareContext?.env) {
    return cloudflareContext.env;
  }

  return null;
}

export function isCloudflareEnvironment(request: NextRequest): boolean {
  return getCloudflareEnv(request) !== null;
}
