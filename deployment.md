# Google Cloud Deployment Guide (Full Stack + All APIs)

This project can run as a **single Cloud Run service**:
- React frontend
- FastAPI backend (`/api/*`)
- one public HTTPS URL for hackathon submission

---

## 1) What "integrate all APIs" means here

All frontend calls are now configured to use one API base:
- `VITE_API_BASE_URL` (frontend env)
- if unset, frontend uses relative paths like `/api/applicants`

For Cloud Run single-service deployment, keep `VITE_API_BASE_URL` empty so frontend and backend share the same domain.

---

## 2) Prerequisites

- Google Cloud project with billing enabled
- [gcloud CLI installed](https://cloud.google.com/sdk/docs/install)
- Docker installed locally
- You are in repo root:
  - `C:\Users\Dell\Documents\Unbiased AI`

---

## 3) One-time Google Cloud setup

```powershell
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud auth configure-docker
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
```

---

## 4) Build and push container image

From repo root:

```powershell
cd engine
docker build -t gcr.io/YOUR_PROJECT_ID/aequitas-gov:latest .
docker push gcr.io/YOUR_PROJECT_ID/aequitas-gov:latest
```

---

## 5) Deploy to Cloud Run

```powershell
gcloud run deploy aequitas-gov `
  --image gcr.io/YOUR_PROJECT_ID/aequitas-gov:latest `
  --platform managed `
  --region asia-south1 `
  --allow-unauthenticated `
  --port 8080 `
  --memory 2Gi `
  --cpu 2 `
  --set-env-vars "CORS_ORIGINS=*"
```

You will receive a live URL like:
- `https://aequitas-gov-xxxxx-uc.a.run.app`

Use that as your submission link.

---

## 6) Verify all APIs are live

Replace `<CLOUD_RUN_URL>` with your URL:

```powershell
curl "<CLOUD_RUN_URL>/api/applicants"
curl "<CLOUD_RUN_URL>/api/fairness"
curl "<CLOUD_RUN_URL>/api/policy"
```

And open `<CLOUD_RUN_URL>` in browser to verify the UI can:
- load applicants
- run simulation
- fetch fairness/policy
- generate audit actions

---

## 7) Integrate Gemini 2.5 + Firebase APIs (Cloud Run)

### A) Gemini 2.5 (required for live explanations)

Set env vars during deploy:

```powershell
gcloud run services update aequitas-gov `
  --region asia-south1 `
  --set-env-vars "GEMINI_API_KEY=YOUR_GEMINI_API_KEY,GEMINI_MODEL=gemini-2.5-flash"
```

You can also use `GOOGLE_API_KEY` instead of `GEMINI_API_KEY`.

### B) Firebase/Firestore (required for persistent audit logs)

1. Create/choose a service account with Firestore permissions.
2. Download service-account JSON key.
3. In Cloud Run, attach credentials either via:
   - **Workload Identity (best)**: grant Cloud Run runtime service account Firestore roles, no key file needed.
   - **Env secret method**: store JSON in Secret Manager and inject as `FIREBASE_SERVICE_ACCOUNT_JSON`.

Example (Secret Manager + env):

```powershell
gcloud secrets create firebase-sa --replication-policy="automatic"
gcloud secrets versions add firebase-sa --data-file="PATH_TO_SERVICE_ACCOUNT.json"

gcloud run services update aequitas-gov `
  --region asia-south1 `
  --update-secrets "FIREBASE_SERVICE_ACCOUNT_JSON=firebase-sa:latest"
```

### C) Other integrated APIs in this app

- `google-genai` (Gemini generation) via `GEMINI_API_KEY`
- `firebase-admin` + `google-cloud-firestore` (audit persistence)
- If Firestore init fails, backend falls back to local JSON log inside container (not persistent across revisions)

---

## 8) Updating after code changes

```powershell
cd engine
docker build -t gcr.io/YOUR_PROJECT_ID/aequitas-gov:latest .
docker push gcr.io/YOUR_PROJECT_ID/aequitas-gov:latest
gcloud run deploy aequitas-gov --image gcr.io/YOUR_PROJECT_ID/aequitas-gov:latest --region asia-south1
```

---

## 9) Optional: split frontend and backend (advanced)

If you deploy frontend separately (Firebase Hosting / Cloud Storage + CDN), set:
- `VITE_API_BASE_URL=https://<your-backend-cloud-run-url>`

Then rebuild frontend before deployment.

For your hackathon deadline, single-service Cloud Run is faster and safer.
