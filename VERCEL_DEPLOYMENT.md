# Vercel Deployment Documentation

This project is configured for deployment on Vercel.

## Deployment Details

- **Project Name:** `glintex-pdf-converter`
- **Production URL:** [https://glintex-pdf-converter.vercel.app](https://glintex-pdf-converter.vercel.app)

## Configuration

### `.vercelignore`
To ensure fast deployments and avoid hitting Vercel's upload limits, the following directories are ignored during the upload process:
- `node_modules`
- `dist`
- `src-tauri` (Desktop build artifacts, ~2.4GB)
- `temp_ref`
- Development scripts (`split_logo.py`, `analyze_excel.js`)

### Project Settings
The project is set up as a **Vite** project with the following defaults:
- **Build Command:** `npm run build` (or `vite build`)
- **Output Directory:** `dist`
- **Framework Preset:** Vite

## How to Redeploy

Since the Vercel CLI is already configured, you can trigger a new production deployment by running:

```bash
vercel --prod --yes
```

The `--yes` flag uses the existing project settings linked in `.vercel/project.json`.
