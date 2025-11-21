// Cloudflare environment types
import { DurableObjectBindings } from './lib/durable-object-helpers';

declare global {
  interface CloudflareEnv extends DurableObjectBindings {
    // Add other bindings here if needed
  }
}

export {};
