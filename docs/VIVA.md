# SENTINEL viva and presentation notes

## One-minute introduction

“SENTINEL is an operator-assisted vehicle-security web application. The operator uploads a plate image or manually enters a registration. Tesseract.js performs OCR in the browser. Clear results proceed directly to matching; uncertain results are read by Gemini Vision through a secure backend. We normalize the detected plate and compare it with the registered vehicles using our own Levenshtein algorithm. Backend rules use the similarity threshold and vehicle status to grant or deny access. Every completed decision is saved in PostgreSQL, with an explainable rule-based risk level. Gemini can then summarize the incident, but cannot make the access decision.”

## Where each technology is used

| Component               | Role                                                                           | Is it AI?                                                          |
| ----------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| React + Vite            | User interface, routes, image preview, operator interaction                    | No                                                                 |
| Tesseract.js            | Runs a pretrained OCR recognition engine in a browser worker using WebAssembly | OCR powered by a pretrained recognition model; we did not train it |
| Gemini Vision           | Multimodal pretrained model reads a plate when OCR is uncertain                | Yes                                                                |
| Plate normalization     | Converts to uppercase and removes separators                                   | No, string processing                                              |
| Levenshtein engine      | Calculates minimum character edits and similarity percentage                   | No, deterministic dynamic programming                              |
| Access rules            | Threshold, status override, ambiguity check                                    | No                                                                 |
| Risk engine             | Transparent rules using match strength and prior 24-hour history               | No, not a trained ML risk model                                    |
| Gemini Incident Analyst | Explains saved incident facts                                                  | Yes, generative AI                                                 |
| Supabase Auth           | Email/password and Google authentication                                       | No                                                                 |
| Supabase PostgreSQL     | Vehicles, settings, operator allowlist, incident audit records                 | No                                                                 |
| Supabase Edge Functions | Trusted orchestration, rule execution, third-party secrets and requests        | No                                                                 |
| Cloudinary              | Authenticated image evidence storage and temporary signed access               | No                                                                 |

## Why Tesseract first and Gemini only when uncertain?

Tesseract can process clear images locally without an OCR API key. Vision is an additional reading step when the text is unclear, reducing unnecessary image-model calls. The default reliable gate requires one recognized standard-format candidate and at least 80% Tesseract confidence. This confidence is an estimate of OCR recognition, not the same as database match similarity.

## Why does Vision still go through Levenshtein?

Vision returns characters, not an access decision. The same normalized plate and matching rules must be applied regardless of how the characters were obtained. This keeps decisions auditable and prevents a language model from authorizing a vehicle.

## Explain Levenshtein with an example

`MH12AB1294` and `MH12AB1234` differ in one character. One substitution is required, and both plates have length ten. Similarity is `(1 - 1/10) × 100 = 90%`. With a 60% threshold and ACTIVE status, access is granted. With BLOCKED or EXPIRED status, it is denied even at 100% similarity. Equal best scores for different vehicles are denied for operator review.

The algorithm considers deletion, insertion, and substitution at each cell. We only keep the previous and current rows, so memory usage is linear in the second string's length. We did not use an external fuzzy-matching package.

## Authentication vs authorization

Authentication confirms an account through Supabase password login or Google OAuth. Authorization checks whether that user belongs to the `operators` allowlist. Row Level Security restricts database access, and every Edge Function independently verifies the session and membership. Signing in with an arbitrary Google account does not grant access.

## Why are access and risk separate?

Access follows the requested registration/threshold rule. Risk is an additional explanation for the operator. For example, an exact ACTIVE plate can be granted while repeated previous denials produce HIGH risk. The UI displays both instead of quietly changing the requested access policy.

## How are secrets and images protected?

Only the public Supabase URL and anon key reach React. Gemini, Cloudinary secret, and Supabase service role stay in backend configuration. Cloudinary evidence is uploaded as `authenticated`; an operator obtains a two-minute signed link through the backend. The database holds image IDs, not unrestricted public images.

## What happens when a service fails?

- Tesseract failure: try Vision as the uncertain path.
- Vision cannot read a plate: request a clearer image or verified manual entry.
- Gemini explanation failure: retain the already-saved deterministic incident; allow a retry.
- Database failure: do not present an unsaved decision as complete.
- Cloudinary failure: image scan cannot complete evidence storage; manual scans remain independent of image storage.
- Network failure: show a safe error and let the operator retry with the same request ID.

## What would we improve next?

Add plate-region cropping/object detection through the `PlateDetectionProvider` interface, test on a labeled dataset to measure precision/recall and false-match rates, add trusted camera ingestion and anti-spoofing, introduce administrator/operator roles, serialize history checks at high throughput, and implement evidence retention. No custom model training is claimed in this project.

## Team slide

Subodh Sharma · Varad Shimpi · Jagdish Panada · Anish Sawant

Use the actual work distribution agreed by the team; the application does not invent individual contribution claims.
