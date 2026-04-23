# Pabandi Platform Deployment Guide

This guide outlines how to deploy the Pabandi platform to Google Cloud Run (Backend) and Firebase Hosting (Frontend).

## Prerequisites
1.  **Google Cloud Project**: Create a project at [console.cloud.google.com](https://console.cloud.google.com).
2.  **Firebase Project**: Enable Firebase for your Google Cloud project at [console.firebase.google.com](https://console.firebase.google.com).
3.  **Billing**: Ensure billing is enabled (Cloud Run requires it, but stays within free tier for low traffic).
4.  **CLI Tools**:
    ```bash
    # Install Firebase Tools
    npm install -g firebase-tools
    # Install Google Cloud SDK
    # Download from https://cloud.google.com/sdk/docs/install
    ```

## 1. Initial Setup
Run these commands locally once to connect your code to the cloud:

```bash
# Login
gcloud auth login
firebase login

# Initialize Google Cloud
gcloud config set project [YOUR_PROJECT_ID]
gcloud services enable run.googleapis.com containerregistry.googleapis.com

# Initialize Firebase
firebase init hosting
# Select "Use an existing project" and choose your project
# Set public directory to "client/dist"
# Configure as single-page app: Yes
```

## 2. Deploying the Backend (Cloud Run)
The backend is containerized. We push it to Google Container Registry and then deploy it.

```bash
cd server
# Build and push to GCR
gcloud builds submit --tag gcr.io/[YOUR_PROJECT_ID]/pabandi-server

# Deploy to Cloud Run
gcloud run deploy pabandi-server \
  --image gcr.io/[YOUR_PROJECT_ID]/pabandi-server \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,DATABASE_URL=[YOUR_SUPABASE_URL],SAFEPAY_API_KEY=[...],FRONTEND_URL=[YOUR_FIREBASE_URL]"
```

## 3. Deploying the Frontend (Firebase Hosting)
First, update `client/.env.production` with your Cloud Run URL.

```bash
cd client
npm run build
firebase deploy --only hosting
```

## 4. Automated CI/CD (Recommended)
The project includes a GitHub Action in `.github/workflows/deploy.yml`. 
To use it:
1.  Push your code to GitHub.
2.  Add the following **Secrets** to your GitHub repository (`Settings > Secrets and variables > Actions`):
    - `GCP_PROJECT_ID`: Your Google Cloud Project ID.
    - `GCP_SA_KEY`: A JSON Key for a Service Account with "Cloud Run Admin" and "Storage Admin" roles.
    - `FIREBASE_TOKEN`: Obtain by running `firebase login:ci`.

Now, every push to `main` will automatically deploy both the frontend and backend.

## Frugal Monitoring
- Set up **Google Cloud Budget Alerts** to notify you if spending exceeds $1.
- Use **Firebase Usage Dashboard** to monitor bandwidth.
