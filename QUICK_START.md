# Quick Start Guide: Durable Objects Implementation

## What Changed?

Your voting application now uses **Cloudflare Durable Objects** to solve the multi-instance problem. Each voting session gets its own persistent, consistent state managed by a Durable Object.

## For Development (Local)

Nothing changes! The app automatically uses the in-memory store when running locally:

```bash
npm run dev
```

Everything works exactly as before.

## For Deployment

### Option 1: Cloudflare Pages (Recommended)

1. **Configure Build Settings in Cloudflare Pages Dashboard**:
   - Build command: `npm run pages:build`
   - Build output directory: `.open-next`

2. **Push your code** to the connected repository

Cloudflare Pages will automatically build and deploy.

📚 See [docs/CLOUDFLARE_PAGES_DEPLOYMENT.md](docs/CLOUDFLARE_PAGES_DEPLOYMENT.md) for detailed instructions.

### Option 2: Manual Deployment with Wrangler

#### First Time Setup

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Login to Cloudflare** (if not already):
   ```bash
   npx wrangler login
   ```

#### Deploy

Simply run:
```bash
npm run deploy
```

This will:
1. Build your app with OpenNext Cloudflare
2. Inject Durable Object exports
3. Deploy to Cloudflare Workers

### Preview Locally with Durable Objects

To test with Durable Objects locally:
```bash
npm run preview
```

## How to Verify It's Working

After deployment:

1. **Create a voting session** - Note the session ID
2. **Vote from multiple devices/browsers** - All should see the same data
3. **Refresh the page** - Data persists (not lost on reload)
4. **Check Cloudflare Dashboard** - You'll see Durable Objects in use

## Configuration Files

The key configuration is in `wrangler.jsonc`:

```json
{
  "durable_objects": {
    "bindings": [{
      "name": "VOTING_SESSION",
      "class_name": "VotingSession"
    }]
  }
}
```

This tells Cloudflare to use your `VotingSession` Durable Object class.

## Troubleshooting

### Issue: "Session not found" errors
- **Cause**: Durable Object binding not configured
- **Fix**: Ensure `wrangler.jsonc` is properly configured and redeployed

### Issue: Votes not persisting
- **Cause**: Running in dev mode (uses in-memory store)
- **Fix**: Deploy to Cloudflare to use Durable Objects

### Issue: Build fails
- **Cause**: Post-build script can't find worker.js
- **Fix**: Ensure OpenNext build completes before script runs

## Cost Considerations

Cloudflare Durable Objects pricing (as of 2025):
- **Workers Paid plan required** ($5/month)
- **Durable Objects**: Included requests + storage
- **Typical usage**: Small voting app should be well within free tier

See: https://developers.cloudflare.com/durable-objects/pricing/

## Next Steps

1. ✅ Deploy to Cloudflare
2. ✅ Test with real users
3. ✅ Monitor usage in Cloudflare Dashboard
4. Optional: Add session cleanup alarms
5. Optional: Add analytics/monitoring

## Need Help?

- **Cloudflare Docs**: https://developers.cloudflare.com/durable-objects/
- **OpenNext Cloudflare**: https://github.com/opennextjs/opennextjs-cloudflare
- **Architecture Details**: See `docs/DURABLE_OBJECTS.md`
- **Full Implementation**: See `IMPLEMENTATION_SUMMARY.md`

## Key Benefits

✅ **Consistent State**: All users see the same data
✅ **Persistent**: Data survives worker restarts  
✅ **Scalable**: Each session isolated
✅ **Real-time**: Updates propagate immediately
✅ **Dev-friendly**: Works locally without Cloudflare
