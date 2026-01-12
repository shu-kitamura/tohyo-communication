import { VoteSessionDO } from './lib/durable_object';

// @ts-ignore .open-next/worker.js is generated at build time
import { default as handler } from './.open-next/worker.js';

export default {
  fetch: handler.fetch,
} satisfies ExportedHandler<CloudflareEnv>;

export { VoteSessionDO };
