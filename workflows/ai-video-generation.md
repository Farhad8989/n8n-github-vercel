# Workflow: AI Video Generation

## Objective
Accept an image and a text prompt from a web user, generate a short AI video using Runway ML, and return the video for playback and download.

## Architecture
```
Browser → Next.js (Vercel) → n8n Webhook → Runway ML API
              ↑                                   ↓
        Polls /api/status ← n8n Status Webhook ← Task Status
```

## Required Inputs
- `image`: Base64 data URI of the source image (JPEG, PNG, or WebP, max 3.5 MB original)
- `prompt`: Text description of the desired video motion
- `ratio` (optional): Aspect ratio — `1280:720` (default), `720:1280`, `960:960`, `1584:672`
- `duration` (optional): `5` (default) or `10` seconds

## Tools Used
- **Next.js** frontend at `/` — image upload + prompt form
- **n8n/workflow-generate-video.json** — POST webhook that starts Runway ML generation
- **n8n/workflow-check-status.json** — GET webhook that polls task status
- **Runway ML API** — `POST /v1/image_to_video` + `GET /v1/tasks/{id}`

## Setup Steps

### 1. Runway ML API Key
1. Sign up at https://dev.runwayml.com
2. Navigate to API Keys → create a new key
3. New accounts receive 500 free credits (gen3a_turbo uses fewer credits/sec)

### 2. n8n Cloud Setup
1. Sign up at https://n8n.cloud (free starter plan)
2. Go to **Settings → Variables** → add `RUNWAY_API_KEY` with your Runway key
3. Import `n8n/workflow-generate-video.json`:
   - Click **+** → **Import from file** → select the JSON
   - Toggle the workflow to **Active**
   - Copy the **Production Webhook URL** (shown in the Webhook node)
4. Repeat for `n8n/workflow-check-status.json`

### 3. Environment Variables
Set these in Vercel dashboard (Settings → Environment Variables):
```
N8N_GENERATE_WEBHOOK_URL = <URL from step 3 above, for generate-video>
N8N_STATUS_WEBHOOK_URL   = <URL from step 3 above, for check-status>
```
For local development, copy `.env.example` → `.env.local` and fill in the values.

### 4. Deploy to Vercel
1. Push this repo to GitHub
2. Connect the repo to Vercel (Import Project)
3. Vercel auto-detects Next.js — no special config needed
4. Add the env vars above in the Vercel dashboard
5. Future pushes to `main` will auto-deploy

## Expected Output
1. User uploads image + enters prompt → clicks Generate
2. App shows loading spinner (polling every 5 seconds)
3. After ~60–120 seconds, video player appears
4. User can watch inline and download the MP4

## Runway ML Status Values
| Runway Status | Frontend Status | Meaning |
|---|---|---|
| QUEUED | processing | Waiting in queue |
| IN_PROGRESS | processing | Actively generating |
| SUCCEEDED | completed | Video URL available |
| FAILED | failed | See failureMessage |

## Edge Cases & Notes
- **Image size**: Runway accepts base64 data URIs up to 5 MB. The app enforces 3.5 MB to account for base64 overhead.
- **Timeouts**: n8n generate workflow has a 60s timeout (just for the API call to start). The actual video generation is async and polled separately.
- **Credits**: 500 free credits on new Runway accounts. gen3a_turbo is the most credit-efficient model. A 5-second clip uses ~5× gen3a_turbo credits/sec.
- **Video URLs**: Runway video URLs expire after some time. Download promptly or store in cloud storage if persistence is needed.
- **Unsupported formats**: GIF is not supported. Only JPEG, PNG, WebP.
- **CORS**: Not an issue — Next.js API routes proxy all requests to n8n server-side.
