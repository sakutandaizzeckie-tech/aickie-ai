# AICKIE AI — V1

A mobile-friendly starter web app for an AI-powered Facebook Page content manager.

## What this package does now
- Dashboard UI
- AICKIE brand settings
- Content idea/caption generation through a server endpoint
- Approval workflow
- Content calendar
- Product database (local demo storage)
- Facebook connection placeholder

## Important Facebook note
This starter does NOT ask for or store a Facebook password. A real Facebook Page connection must use Meta's official OAuth/Graph API flow and an approved Meta app with the required permissions.

## Run locally
Requires Node.js 20+.

```bash
npm install
cp .env.example .env
npm run dev
```

Open the local URL shown by Vite.

## AI
Set `OPENAI_API_KEY` in `.env` to enable the server-side AI generation endpoint.

If no API key is configured, the app still runs in demo mode with sample content.

## Facebook
The UI includes a connection flow placeholder. Before production use, create a Meta developer app and implement OAuth + Page access token handling on a secure backend. Do not put Meta secrets or OpenAI keys in browser code.

## Deploy
This starter is structured for a Node/Vite deployment. Build with:

```bash
npm run build
npm run start
```

For production, use HTTPS and store secrets in your hosting provider's environment variables.
