# Durable Objects Implementation

## Overview

This application now uses Cloudflare Durable Objects to manage voting session state, ensuring that all requests for a given session are handled by the same Durable Object instance, regardless of which worker instance receives the request.

## Architecture

### Components

1. **VotingSession Durable Object** (`lib/durable-objects/VotingSession.ts`)
   - Manages the state for a single voting session
   - Stores session data, votes, and voter tokens
   - Persists state to Durable Object storage

2. **Storage Adapter** (`lib/storage-adapter.ts`)
   - Provides a unified interface for both development and production
   - In development: Uses in-memory store
   - In production: Uses Durable Objects

3. **API Routes** (Updated)
   - All routes now use the storage adapter
   - Automatically detect the environment and use the appropriate backend

## How It Works

### Session Creation
When a voting session is created, a unique Durable Object instance is created for that session ID using `idFromName(sessionId)`. This ensures that all operations for that session go to the same Durable Object.

### Voting
When a user submits a vote, the request is routed to the Durable Object for that session, which:
1. Validates the vote
2. Updates vote counts
3. Records the voter token
4. Persists the changes to storage

### Real-time Updates
The SSE stream endpoint polls the Durable Object for updates, ensuring clients always see the latest vote counts.

## Configuration

### wrangler.jsonc
The Durable Object is configured with:
- **Binding name**: `VOTING_SESSION`
- **Class name**: `VotingSession`
- **Script name**: `tohyo-communication`

### Build Process
When building for Cloudflare:
```bash
npm run preview  # Build and preview
npm run deploy   # Build and deploy
```

The OpenNext Cloudflare build process will bundle the Durable Object class with the worker.

## Local Development

During local development, the application falls back to using the in-memory store since Durable Objects are not available. This allows for seamless development without requiring a Cloudflare account.

## Deployment

When deployed to Cloudflare Workers:
1. The worker is built using OpenNext Cloudflare
2. The Durable Object binding is configured in wrangler.jsonc
3. Requests automatically use Durable Objects for state management

## Benefits

- **Consistency**: All requests for a session hit the same Durable Object instance
- **Persistence**: Data is persisted to Durable Object storage
- **Scalability**: Each session gets its own Durable Object instance
- **Real-time**: Updates are immediately available to all clients
