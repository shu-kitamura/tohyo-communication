// instrumentation.ts - Ensures Durable Objects are loaded in the worker bundle
export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') {
    // Import Durable Objects to ensure they're bundled
    await import('./lib/durable-objects/VotingSession');
  }
}
