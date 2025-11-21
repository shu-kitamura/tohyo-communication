// Wrapper entrypoint for Cloudflare Workers.
// Re-export the OpenNext-generated worker and add Durable Object exports.
import openNextWorker from "./.open-next/worker.js";

// Re-export OpenNext worker behavior
export const fetch = openNextWorker.fetch;
export default openNextWorker;
export * from "./.open-next/worker.js";

// Export Durable Object classes for Wrangler bindings
export { VotingSession } from "./lib/durable-objects/VotingSession";
