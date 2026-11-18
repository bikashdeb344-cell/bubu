# MMU Photo Portal

A production-ready, lightweight, mobile-first web application and Android app designed to upload photographs directly into structured Google Drive directories (`MMU-PHOTO-STORAGE/<MMU-ID>/{AM,PM}/`) with automatic standardized renaming.

Built with a free-tier serverless architecture using **React + Vite + Tailwind CSS** on the frontend, **Cloudflare Workers** on the backend, **Google Drive API v3** with personal Google account OAuth 2.0 (15 GB quota), and a lightweight native **Android WebView APK**.

---

## 1. Live Deployment Endpoints

| Component | URL / Location | Status |
|---|---|---|
| **Production Web App** | [https://bikashdeb344-cell.github.io/bubu/](https://bikashdeb344-cell.github.io/bubu/) | 🟢 **Live & Operational** |
| **Edge Worker API** | `https://mmu-photo-portal-worker.bikashdeb344.workers.dev` | 🟢 **Live (HTTP 200)** |
| **Android App (APK)** | [`MMU-Photo-Portal.apk`](./MMU-Photo-Portal.apk) (868 KB) | 🟢 **Ready for Install** |
| **Google Drive Storage** | [`MMU-PHOTO-STORAGE`](https://drive.google.com/drive/folders/1a5-PEzrzoSR4gPM4rjCtWEZ5cSgs-r-a) | 🟢 **18/18 Verified** |

---

## 2. Standardized Photo Renaming Scheme

Every photo uploaded through the web portal or Android app is automatically inspected for dates (EXIF capture timestamp or filename patterns like `IMG-20261117-WA0061.jpg`, `20261025_192724.jpg`, `Screenshot...`) before renaming and saving to Google Drive:

| Session | Single Photo Upload | Multiple Photos Batch Upload |
|---|---|---|
| **AM (Morning Check-in)** | `[DD MON YYYY IN-photo].ext`<br>*(e.g., `[25 OCT 2026 IN-photo].jpg`)* | `[DD MON YYYY IN-photo-1].ext`<br>`[DD MON YYYY IN-photo-2].ext`<br>*(e.g., `[25 OCT 2026 IN-photo-1].jpg`)* |
| **PM (Evening Check-out)** | `[DD MON YYYY OUT-photo].ext`<br>*(e.g., `[25 OCT 2026 OUT-photo].jpg`)* | `[DD MON YYYY OUT-photo-1].ext`<br>`[DD MON YYYY OUT-photo-2].ext`<br>*(e.g., `[25 OCT 2026 OUT-photo-1].jpg`)* |

* **Date Intelligence**:
  * Scans filename for WhatsApp (`IMG-YYYYMMDD-WA...`), Camera (`YYYYMMDD_HHMMSS`), and screenshot/ISO dates (`YYYY-MM-DD`, `DD-MM-YYYY`).
  * Scans JPEG/PNG binary headers for EXIF capture timestamps.
  * Defaults to the current Indian Standard Time (IST, UTC+5:30) date if no date is found.
* **Format**: Square brackets enclosing the date and session (`[DD MON YYYY IN/OUT-photo]`), preserving the original file extension (`.jpg`, `.jpeg`, `.png`, `.webp`).
* The web portal provides a real-time target name preview (`↳ [25 OCT 2026 IN-photo].jpg`) beneath each photo thumbnail prior to upload.

---

## 3. MMU Fleet Directory Structure

The portal manages the 9 designated Mobile Medical Units with 18 subdirectories under the root folder `MMU-PHOTO-STORAGE`:

```
MMU-PHOTO-STORAGE/
├── MMU-003/
│   ├── AM/
│   └── PM/
├── MMU-106/
│   ├── AM/
│   └── PM/
├── MMU-004/
│   ├── AM/
│   └── PM/
├── MMU-110/
│   ├── AM/
│   └── PM/
├── MMU-091/
│   ├── AM/
│   └── PM/
├── MMU-107/
│   ├── AM/
│   └── PM/
├── MMU-108/
│   ├── AM/
│   └── PM/
├── MMU-100/
│   ├── AM/
│   └── PM/
└── MMU-101/
    ├── AM/
    └── PM/
```

### Self-Healing & Directory Verification
On startup or when clicking **"Recheck Google Drive"**:
1. Connects to Google Drive using secure backend OAuth credentials.
2. Scans the root folder `MMU-PHOTO-STORAGE` (`1a5-PEzrzoSR4gPM4rjCtWEZ5cSgs-r-a`).
3. Confirms all 9 MMU units and 18 session subdirectories exist; automatically repairs any missing folders.
4. Uploads remain locked until `18/18 Directories Verified` is confirmed.

---

## 4. Key Portal Features

* **Mobile-First UX**: Responsive card layout, tactile session toggles (AM/PM), multi-file drag-and-drop dropzone, and individual image removal.
* **Auto-Refresh After Every Upload**: When a submission completes successfully, the portal displays a confirmation banner and automatically reloads after 2.5 seconds, resetting all fields cleanly for the next batch.
* **Abuse Prevention & Security**: Edge rate-limiting (60 req/min), CORS restrictions, and magic byte validation for JPEG, PNG, and WEBP.
* **Zero Client Secrets**: Sensitive Google OAuth keys are securely stored in Cloudflare encrypted secrets; zero credentials are exposed in client bundles.

---

## 5. Android WebView Application

An ultra-lightweight, native Android app is provided in [`android/`](./android):
* **Direct Download**: [`MMU-Photo-Portal.apk`](./MMU-Photo-Portal.apk) (868 KB).
* **Hardware-Accelerated WebView**: Loads the live portal with full JavaScript and DOM storage support.
* **Native File Chooser**: Implements `WebChromeClient.onShowFileChooser` allowing field users to pick multiple photos from gallery, file manager, or directly capture from camera.
* **Gesture-Safe**: Pull-to-refresh is omitted to avoid accidental reloads while selecting photos.
* **Back Button Navigation**: Uses device back button for in-app history navigation.

---

## 6. Automated Test Suite (54/54 Passed)

```bash
# Run backend tests (Vitest)
npm --prefix worker test

# Run frontend tests (Vitest & RTL)
npm --prefix frontend test
```

* **39 Backend Tests**: Directory validation, magic byte verification, session tags, 4-digit IST date parts, WhatsApp/camera/screenshot date parsing, EXIF headers, single/multi-photo renaming, rate limiting, and error handling.
* **15 Frontend Tests**: Dropdown options, session selection, previews, target filename display `[DD MON YYYY IN/OUT-photo].ext`, client-side date extraction, submission guards, and local history logging.

---

## 7. Deployment Instructions

### Frontend (GitHub Pages)
```bash
npm --prefix frontend run build
```
Automatically deployed to GitHub Pages via `.github/workflows/deploy.yml` on push to `main`.

### Backend (Cloudflare Worker)
```bash
npx wrangler deploy --cwd worker
```

### Android APK Build
```bash
cd android
./gradlew assembleDebug
```
Output APK generated at `android/app/build/outputs/apk/debug/app-debug.apk`.
