# Smart-Vehicle-Incident-Monitor

## AI Cloud OCR & Fuzzy Tracking System

This repository now includes a minimal OCR-driven fuzzy tracking pipeline:

- `InMemoryCloudOCRProvider` simulates cloud OCR responses for image IDs.
- `FuzzyIncidentTracker` matches OCR text to known incident vehicle identifiers.
- `fuzzy_similarity` normalizes identifier text and computes fuzzy match score.

### Run tests

```bash
python -m unittest discover -s tests
```