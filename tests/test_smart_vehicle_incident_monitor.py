import unittest

from smart_vehicle_incident_monitor import (
    FuzzyIncidentTracker,
    IncidentRecord,
    InMemoryCloudOCRProvider,
    OCRResult,
    fuzzy_similarity,
)


class FuzzySimilarityTests(unittest.TestCase):
    def test_normalization_ignores_punctuation_and_case(self) -> None:
        score = fuzzy_similarity("ab-12 cd", "AB12CD")
        self.assertEqual(score, 1.0)

    def test_empty_values_return_zero(self) -> None:
        self.assertEqual(fuzzy_similarity("", "AB12CD"), 0.0)


class FuzzyIncidentTrackerTests(unittest.TestCase):
    def test_tracker_returns_best_match_above_thresholds(self) -> None:
        ocr_provider = InMemoryCloudOCRProvider(
            responses={
                "img-1": OCRResult(image_id="img-1", text="AB12CD", confidence=0.95),
                "img-2": OCRResult(image_id="img-2", text="XY98ZZ", confidence=0.5),
            }
        )
        tracker = FuzzyIncidentTracker(ocr_provider, min_ocr_confidence=0.6, min_fuzzy_score=0.7)
        incidents = [
            IncidentRecord(incident_id="inc-100", vehicle_identifier="AB12-CD"),
            IncidentRecord(incident_id="inc-200", vehicle_identifier="MN45PQ"),
        ]

        tracked = tracker.track(["img-1", "img-2"], incidents)

        self.assertEqual(len(tracked), 1)
        self.assertEqual(tracked[0].incident_id, "inc-100")
        self.assertEqual(tracked[0].image_id, "img-1")

    def test_tracker_skips_low_fuzzy_score(self) -> None:
        ocr_provider = InMemoryCloudOCRProvider(
            responses={"img-3": OCRResult(image_id="img-3", text="QWERTY", confidence=0.99)}
        )
        tracker = FuzzyIncidentTracker(ocr_provider, min_ocr_confidence=0.6, min_fuzzy_score=0.8)
        incidents = [IncidentRecord(incident_id="inc-300", vehicle_identifier="AB12CD")]

        tracked = tracker.track(["img-3"], incidents)

        self.assertEqual(tracked, [])


if __name__ == "__main__":
    unittest.main()
