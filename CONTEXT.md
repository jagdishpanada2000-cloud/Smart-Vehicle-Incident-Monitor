# SENTINEL — Context & Terminology

## What It Is
A vehicle-entry monitoring system for college/security use. Operators scan number plates (by image or manual entry), the system matches them against a registered vehicle registry, logs the access decision, and optionally generates an AI explanation using Gemini.

## Architecture Decision
The Spring Boot backend (port 8080) owns all application logic — database queries, scan decisions, Levenshtein matching, risk scoring, Cloudinary uploads, and Gemini calls. The React frontend calls `/api/*` endpoints only. Supabase is used **solely for authentication** (Google OAuth + email/password); it no longer runs Edge Functions for production scanning.

## Key Terms

| Term | Meaning |
|---|---|
| **Operator** | A signed-in account explicitly added to `public.operators` in the DB |
| **Registered vehicle** | A plate number, owner, type, and status row in `registered_vehicles` |
| **Scan** | One plate observation submitted (image OCR or manual entry) |
| **Incident** | The saved record of a scan and its access decision |
| **Evidence** | The original image uploaded to Cloudinary, accessible only to operators |
| **Match similarity** | `(1 - edit_distance / max_length) * 100` — Levenshtein-based % |
| **OCR confidence** | Tesseract's confidence in the extracted text (not the same as similarity) |
| **Access decision** | Rule-based GRANTED or DENIED — does not control a physical gate |
| **Risk level** | LOW / MEDIUM / HIGH based on match quality and 24-hour scan history |

## Access Decision Rules (in order)
1. No match found → DENIED
2. Best match below similarity threshold → DENIED
3. Tied best match → DENIED (safe-fail)
4. Vehicle status BLOCKED or EXPIRED → DENIED
5. Otherwise → GRANTED

## Risk Classification
- **HIGH** — any denial, or 3+ previous denials for exact plate in 24h
- **MEDIUM** — similarity < 85%, any prior denial, or 3+ previous scans
- **LOW** — everything else

## Services
| Service | Port | Technology |
|---|---|---|
| PostgreSQL | 5432 | Docker `postgres:15-alpine` |
| Spring Boot API | 8080 | Java 21, Maven (bundled in `.tools/`) |
| React Frontend | 5174 | Vite, React 19, TypeScript |
