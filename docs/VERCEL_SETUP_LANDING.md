# Vercel Setup: Landing Page (modulajar.app)

Follow these steps to deploy the marketing landing page.

## Project Configuration

1. **Create New Project**: Select the `modulajar` repository.
2. **Root Directory**: Set to `apps/web`.
3. **Framework Preset**: Next.js.
4. **Build Command**: `npm run build` (Default).
5. **Output Directory**: `.next` (Default).
6. **Install Command**: `npm install` (Default).

## Domains

Map the following domains to this project:
- `modulajar.app`
- `www.modulajar.app`

## Environment Variables

Add the following variables in the Vercel dashboard:

| Variable | Value | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | `https://app.modulajar.app` | Link to the main app |
| `NEXT_PUBLIC_VERIFY_URL` | `https://verify.modulajar.app` | Link to verification service |

## Optimization

The landing page is designed for **Static Generation**. Vercel will automatically optimize delivery via its Edge Network.
