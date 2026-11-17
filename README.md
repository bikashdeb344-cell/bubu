# MMU Photo Portal

A production-ready, lightweight, mobile-first web application designed to upload photographs directly into structured Google Drive directories (`MMU-PHOTO-STORAGE/MMU-001..009/{AM,PM}/`).

Built with a free-tier serverless architecture using **React + Vite + Tailwind CSS** on the frontend, **Cloudflare Workers** on the backend, and **Google Drive API v3** with secure OAuth 2.0.

---

## 1. Architecture Overview

```
[Mobile / Tablet / Desktop Browser]
            │
            │ HTTPS (Multipart Photo Upload / Drive Status)
            ▼
[Cloudflare Worker Backend] (Edge Network)
  ├── 1. Rate Limiting & CORS Enforcement
  ├── 2. Image Validation (MIME & Magic Bytes: JPG, PNG, WEBP)
  ├── 3. Directory Auto-Creation & Validation (18/18 Folders)
  └── 4. OAuth 2.0 Token Refresh & Resumable Upload
            │
            │ Google Drive API v3 (Direct API)
            ▼
[Google Drive Storage: MMU-PHOTO-STORAGE]
  ├── MMU-001 / [AM, PM]
  ├── MMU-002 / [AM, PM]
  ├── MMU-003 / [AM, PM]
  ├── MMU-004 / [AM, PM]
  ├── MMU-005 / [AM, PM]
  ├── MMU-006 / [AM, PM]
  ├── MMU-007 / [AM, PM]
  ├── MMU-008 / [AM, PM]
  └── MMU-009 / [AM, PM]
```

---

## 2. Technology Stack

- **Frontend:**
  - React 18 & TypeScript
  - Vite for optimized bundling (~54 kB gzip)
  - Tailwind CSS for mobile-first responsive styling
  - Lucide React for modern iconography
  - Vitest & React Testing Library for QA
- **Backend:**
  - Cloudflare Workers (TypeScript)
  - Google Drive API v3 (Resumable Upload Protocol)
  - Google OAuth 2.0 (Refresh Token authentication)
  - In-memory rate limiting and magic byte file validation
- **Deployment & CI/CD:**
  - GitHub Actions for automated testing and deployment
  - Static hosting on GitHub Pages / Cloudflare Pages
  - Cloudflare Worker serverless edge deployment

---

## 3. Google Drive Directory Structure

The portal manages exactly **9 MMU directories** and **18 subdirectories** under the root folder (`MMU-PHOTO-STORAGE`):

```
MMU-PHOTO-STORAGE/
├── MMU-001/
│   ├── AM/
│   └── PM/
├── MMU-002/
│   ├── AM/
│   └── PM/
├── MMU-003/
│   ├── AM/
│   └── PM/
├── MMU-004/
│   ├── AM/
│   └── PM/
├── MMU-005/
│   ├── AM/
│   └── PM/
├── MMU-006/
│   ├── AM/
│   └── PM/
├── MMU-007/
│   ├── AM/
│   └── PM/
├── MMU-008/
│   ├── AM/
│   └── PM/
└── MMU-009/
    ├── AM/
    └── PM/
```

### Automatic Directory Validation & Self-Healing
On startup or when clicking **"Recheck Google Drive"**:
1. Connects to Google Drive using backend credentials.
2. Locates the root folder `MMU-PHOTO-STORAGE`.
3. Verifies all 9 MMU units exist; creates any missing ones.
4. Verifies all 18 AM/PM folders exist; creates any missing subdirectories under the correct parent.
5. Uploads are strictly disabled until `18/18 Directories Verified` is confirmed.

---

## 4. Setup & Configuration Guide

### Step 1: Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `MMU-Photo-Storage`).
3. Enable the **Google Drive API**:
   - Navigate to **APIs & Services > Library** -> Search for **Google Drive API** -> Click **Enable**.
4. Configure OAuth Consent Screen:
   - Select **External** (or Internal for Workspace).
   - Add scope: `https://www.googleapis.com/auth/drive` or `https://www.googleapis.com/auth/drive.file`.
   - Add your Google account under **Test Users**.
5. Create OAuth 2.0 Client ID:
   - Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
   - Application type: **Web application**.
   - Authorized redirect URIs: `https://developers.google.com/oauthplayground`.
   - Copy the **Client ID** and **Client Secret**.
6. Generate OAuth Refresh Token:
   - Open [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
   - Click the gear icon (top right) -> Check **"Use your own OAuth credentials"**.
   - Enter your Client ID and Client Secret.
   - In Step 1, enter scope `https://www.googleapis.com/auth/drive` and click **Authorize APIs**.
   - Sign in with your storage Google account and grant permissions.
   - In Step 2, click **Exchange authorization code for tokens**.
   - Copy the generated `refresh_token`.
7. Obtain Google Drive Root Folder ID:
   - In Google Drive, create a folder named `MMU-PHOTO-STORAGE`.
   - Open the folder. The URL will look like: `https://drive.google.com/drive/folders/1A2B3C4D5E6F7G8H9I0J-XYZ`
   - Copy the ID string (`1A2B3C4D5E6F7G8H9I0J-XYZ`).

---

### Step 2: Backend Cloudflare Worker Secrets

In `worker/`, create `.dev.vars` for local testing (or set them via Wrangler CLI in production):

```ini
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-google-client-secret
GOOGLE_REFRESH_TOKEN=1//your-oauth-refresh-token
GOOGLE_DRIVE_ROOT_FOLDER_ID=your-root-folder-id
ALLOWED_ORIGIN=*
MAX_FILE_SIZE_MB=15
MAX_FILES_PER_UPLOAD=20
```

To set production secrets in Cloudflare:
```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_REFRESH_TOKEN
npx wrangler secret put GOOGLE_DRIVE_ROOT_FOLDER_ID
```

---

### Step 3: Frontend Configuration

In `frontend/`, create `.env` for local testing:

```ini
VITE_API_BASE_URL=http://localhost:8787
```

In production, set `VITE_API_BASE_URL` to your Cloudflare Worker domain (e.g. `https://mmu-photo-portal-worker.<subdomain>.workers.dev`).

---

## 5. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Backend health status and timestamp |
| `GET` | `/api/drive/status` | Scans Google Drive and verifies all 18 directories |
| `POST` | `/api/drive/initialize` | Automatically heals/creates missing MMU and AM/PM folders |
| `POST` | `/api/upload` | Validates and uploads multipart photographs to target MMU/session folder |

### POST /api/upload Parameters
- `mmu`: String (`MMU-001` through `MMU-009`)
- `session`: String (`AM` or `PM`)
- `photos`: One or multiple files (`.jpg`, `.jpeg`, `.png`, `.webp`)

---

## 6. Local Development & Testing

### Install all dependencies:
```bash
npm install
```

### Run tests:
```bash
# Run backend worker tests (21 tests)
npm run test:worker

# Run frontend tests (8 tests)
npm run test:frontend

# Run all tests
npm test
```

### Start local dev servers:
```bash
# Terminal 1: Cloudflare Worker backend (port 8787)
cd worker && npm run dev

# Terminal 2: React Vite frontend (port 5173)
cd frontend && npm run dev
```

---

## 7. Automated CI/CD (GitHub Actions)

The repository includes `.github/workflows/deploy.yml`:
1. **CI Pipeline**: Runs all frontend and backend unit tests on every pull request and push.
2. **Deploy Worker**: Deploys the worker to Cloudflare with zero downtime.
3. **Deploy Frontend**: Automatically builds and deploys static assets to GitHub Pages.

Required GitHub Secrets for deployment:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_API_BASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`

---

## 8. License

MIT
