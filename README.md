# SENTINEL — Smart Vehicle Incident Monitor

A React + Spring Boot vehicle access monitoring system. React handles the UI and browser OCR (Tesseract.js); Spring Boot owns all API logic, database access, and external provider calls; Supabase provides authentication only.

---

## Architecture

```
Browser (React + Vite)
  │  Tesseract.js OCR (browser WebWorker)
  │  Supabase Auth (session only)
  └──► /api/* ──► Spring Boot (port 8080)
                    └──► PostgreSQL (port 5432)
                    └──► Gemini API (AI explanation)
                    └──► Cloudinary (evidence images)
```

---

## Prerequisites

| Tool | Required |
|---|---|
| Node.js 20+ | Frontend (`npm`) |
| Java 21+ (JDK) | Backend (Spring Boot) |
| Docker Desktop | Local PostgreSQL |
| Internet access | Tesseract CDN on first scan |

Maven is bundled at `.tools/apache-maven-3.9.11` — no separate install needed.

---

## Quick Start (all three services)

From the project root in **PowerShell**:

```powershell
.\start.ps1
```

This will:
1. Start the `sentinel-postgres` Docker container on port `5432`
2. Launch Spring Boot backend in a new terminal on port `8080`
3. Start Vite frontend on **http://127.0.0.1:5174**

---

## Manual Start (separate terminals)

### 1. Database (PostgreSQL via Docker)

First-time setup — run **once**:
```powershell
docker run -d --name sentinel-postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=sentinel `
  -p 5432:5432 postgres:15-alpine
```

After first setup, just start the container:
```powershell
docker start sentinel-postgres
```

Initialize schema (first time only):
```powershell
Get-Content supabase\migrations\202609210001_sentinel.sql | docker exec -i sentinel-postgres psql -U postgres -d sentinel
Get-Content supabase\seed.sql | docker exec -i sentinel-postgres psql -U postgres -d sentinel
```

### 2. Backend (Spring Boot — port 8080)

```powershell
npm run backend
```

Verify: http://127.0.0.1:8080/api/health → `{"status":"UP","service":"sentinel-api"}`

### 3. Frontend (Vite React — port 5174)

```powershell
npm run dev
```

Open: **http://127.0.0.1:5174**

---

## Environment Variables

The `.env` file is already configured with the project's Supabase settings.

| Variable | File | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `.env` | Supabase public anon key |
| `VITE_API_BASE_URL` | `.env` | Spring Boot API base (`/api`) |

Backend credentials (Gemini, Cloudinary) are already defaulted inside `backend/src/main/resources/application.properties`. For production, override via environment variables or `backend/application-local.properties`.

---

## Available npm Scripts

```powershell
npm run dev          # Start Vite frontend (port 5174)
npm run backend      # Start Spring Boot backend (port 8080)
npm run build        # TypeScript check + production bundle
npm test             # Vitest unit + SQL tests (62 tests)
npm run test:browser # Playwright browser tests (7 tests)
npm run check:edge   # Deno type-check Edge Functions (no deploy)
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `operators` | Allowlist of authorized user accounts |
| `registered_vehicles` | Normalized plate, owner, type, status |
| `system_settings` | Similarity threshold, OCR threshold |
| `incident_log` | Immutable scan records with decision and AI explanation |
| `request_limits` | Per-user rate limiting counters |

---

## Project Structure

```
├── backend/                # Spring Boot Java API (Maven project)
│   ├── pom.xml
│   └── src/main/java/com/sentinel/
│       ├── SentinelApplication.java
│       ├── ApiController.java   # REST endpoints
│       ├── SecurityConfig.java  # Supabase token introspection
│       ├── SentinelRepository.java
│       ├── ScanService.java
│       ├── GeminiService.java
│       ├── CloudinaryService.java
│       ├── PlateRules.java
│       └── Models.java
├── src/                    # React + Vite frontend
│   ├── App.tsx
│   ├── pages/              # Dashboard, Scanner, Vehicles, Incidents, System
│   ├── components/
│   ├── hooks/
│   └── lib/
│       ├── supabase.ts     # Auth client only
│       └── api.ts          # All REST calls to /api/*
├── supabase/
│   ├── migrations/         # SQL schema
│   ├── seed.sql            # Sample data (10 vehicles, 24 incidents)
│   └── functions/          # Optional Supabase Edge Functions (legacy)
├── tests/                  # Vitest + Playwright tests
├── start.ps1               # One-command startup script
├── .env                    # Supabase public config (already filled)
├── vite.config.ts          # Vite config + /api proxy to :8080
└── package.json
```

---

## Demo Scan Values

| Plate | Expected Result |
|---|---|
| `MH12AB1234` | ✅ GRANTED — ACTIVE, exact match |
| `MH12AB1294` | ✅ GRANTED — 90% similarity, above 60% threshold |
| `MH01XY9090` | ❌ DENIED — BLOCKED vehicle |
| `MH04EF2468` | ❌ DENIED — EXPIRED vehicle |
| Upload a plate image | Tesseract OCR → Spring Boot decision |

---

## Team

Subodh Sharma, Varad Shimpi, Jagdish Panada, Anish Sawant
