# Calling Agent Dashboard

Next.js 14 dashboard for orchestrating outbound voice calls with a Twilio-powered agent. Generate tailored call scripts, launch or schedule calls inside a single interface, and keep a lightweight launch history locally.

## Quickstart

```bash
npm install
npm run dev
```

Access the UI at `http://localhost:3000`.

## Environment

Create a `.env.local` file with:

```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
# Optional webhook for status events
TWILIO_STATUS_WEBHOOK_URL=https://example.com/api/twilio/callback
```

> The serverless worker supports pausing outbound calls for up to 10 minutes when a schedule is provided.

## Deployment

The project targets Vercel. After installing dependencies and running `npm run build` locally, deploy with:

```bash
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-cbbba98f
```

## Scripts

- `npm run dev` – start development server
- `npm run build` – production build
- `npm run start` – serve the build
- `npm run lint` – lint with Next.js defaults

## Notes

- Launch history persists in the browser via `localStorage`.
- Twilio credentials are required for live calls. Without them, API requests return an actionable error.
