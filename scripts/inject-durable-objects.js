#!/usr/bin/env node

/**
 * Post-build script to inject Durable Object exports into the OpenNext worker
 */

const fs = require('fs');
const path = require('path');

const workerPath = path.join(__dirname, '../.open-next/worker.js');

if (!fs.existsSync(workerPath)) {
  console.log('⚠️  Worker file not found - this is normal for local dev builds');
  process.exit(0);
}

// Read the current worker
let workerContent = fs.readFileSync(workerPath, 'utf-8');

// Add Durable Object import and export
// The path is relative to .open-next/worker.js
const durableObjectCode = `
// Durable Object class import - relative to .open-next/worker.js
import { VotingSession } from '../lib/durable-objects/VotingSession';

// Export Durable Object for Cloudflare Workers
export { VotingSession };
`;

// Check if already added (avoid adding multiple times)
if (!workerContent.includes('export { VotingSession }')) {
  // Append to the end of the file
  workerContent += '\n' + durableObjectCode;
  fs.writeFileSync(workerPath, workerContent, 'utf-8');
  console.log('✅ Durable Object export added to worker');
} else {
  console.log('✅ Durable Object export already present');
}

console.log('✅ Post-build processing complete');
