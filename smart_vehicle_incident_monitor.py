"""AI cloud OCR and fuzzy incident tracking utilities."""

from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Dict, Iterable, List, Protocol


@dataclass(frozen=True)
class OCRResult:
    image_id: str
    text: str
    confidence: float


@dataclass(frozen=True)
class IncidentRecord:
    incident_id: str
    vehicle_identifier: str


@dataclass(frozen=True)
class TrackedIncident:
    image_id: str
    incident_id: str
    extracted_text: str
    ocr_confidence: float
    fuzzy_score: float


class CloudOCRProvider(Protocol):
    def extract_text(self, image_id: str) -> OCRResult:
        """Return OCR text for an image identifier."""


class InMemoryCloudOCRProvider:
    """Simple deterministic OCR provider backed by in-memory responses."""

    def __init__(self, responses: Dict[str, OCRResult]) -> None:
        self._responses = responses

    def extract_text(self, image_id: str) -> OCRResult:
        if image_id not in self._responses:
            raise KeyError(f"No OCR response for image_id '{image_id}'")
        return self._responses[image_id]


def _normalize_identifier(value: str) -> str:
    return "".join(ch for ch in value.upper() if ch.isalnum())


def fuzzy_similarity(left: str, right: str) -> float:
    """Return similarity score from 0.0 to 1.0 for vehicle identifiers."""

    left_normalized = _normalize_identifier(left)
    right_normalized = _normalize_identifier(right)
    if not left_normalized or not right_normalized:
        return 0.0
    return SequenceMatcher(None, left_normalized, right_normalized).ratio()


class FuzzyIncidentTracker:
    def __init__(
        self,
        ocr_provider: CloudOCRProvider,
        min_ocr_confidence: float = 0.6,
        min_fuzzy_score: float = 0.75,
    ) -> None:
        self._ocr_provider = ocr_provider
        self._min_ocr_confidence = min_ocr_confidence
        self._min_fuzzy_score = min_fuzzy_score

    def track(
        self,
        image_ids: Iterable[str],
        incidents: Iterable[IncidentRecord],
    ) -> List[TrackedIncident]:
        indexed_incidents = list(incidents)
        tracked: List[TrackedIncident] = []

        for image_id in image_ids:
            ocr = self._ocr_provider.extract_text(image_id)
            if ocr.confidence < self._min_ocr_confidence:
                continue

            best_incident = None
            best_score = 0.0
            for incident in indexed_incidents:
                score = fuzzy_similarity(ocr.text, incident.vehicle_identifier)
                if score > best_score:
                    best_score = score
                    best_incident = incident

            if best_incident is None or best_score < self._min_fuzzy_score:
                continue

            tracked.append(
                TrackedIncident(
                    image_id=image_id,
                    incident_id=best_incident.incident_id,
                    extracted_text=ocr.text,
                    ocr_confidence=ocr.confidence,
                    fuzzy_score=best_score,
                )
            )

        return tracked
