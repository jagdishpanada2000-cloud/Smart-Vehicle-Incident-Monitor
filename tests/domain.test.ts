import { describe, expect, it } from "vitest";
import {
  assessOcr,
  calculateLevenshteinDistance as distance,
  calculateSimilarity as similarity,
  evaluateScan,
  extractPlateCandidates,
  findBestVehicleMatch,
  isValidPlate,
  normalizePlate,
  type Vehicle,
} from "../supabase/functions/_shared/domain";
const vehicle = (
  plate = "MH12AB1234",
  status: Vehicle["status"] = "ACTIVE",
): Vehicle => ({
  vehicle_id: plate,
  plate_number: plate,
  owner_name: "Test owner",
  vehicle_type: "Car",
  status,
  created_at: "2026-09-21T00:00:00Z",
});
describe("plate normalization and OCR routing", () => {
  it.each(["MH-12 AB 1234", "MH12AB1234", "mh12ab1234", "MH 12 AB 1234"])(
    "normalizes %s",
    (value) => expect(normalizePlate(value)).toBe("MH12AB1234"),
  );
  it.each(["", "A", "123456", "ABCDEFG", "MH123456789012345", "MH!12AB"])(
    "rejects invalid normalized input %s",
    (value) => expect(isValidPlate(value)).toBe(false),
  );
  it("extracts state and BH registration candidates from multiple lines", () => {
    expect(extractPlateCandidates("INDIA\nMH 12 AB 1234\n")).toEqual([
      "MH12AB1234",
    ]);
    expect(extractPlateCandidates("24 BH 1234 AA")).toEqual(["24BH1234AA"]);
  });
  it("routes a single confident candidate directly", () =>
    expect(assessOcr("MH12AB1234", 80, 80).reliable).toBe(true));
  it("routes low confidence, multiple candidates, no candidates and invalid confidence to vision", () => {
    expect(assessOcr("MH12AB1234", 79.9, 80).reliable).toBe(false);
    expect(assessOcr("MH12AB1234\nMH14CD5678", 99, 80).reliable).toBe(false);
    expect(assessOcr("BLURRY", 99, 80).reliable).toBe(false);
    expect(assessOcr("MH12AB1234", NaN, 80).reliable).toBe(false);
  });
  it("deduplicates repeated recognition of the same plate", () =>
    expect(assessOcr("MH12AB1234\nMH12AB1234", 95, 80).reliable).toBe(true));
});
describe("Levenshtein and matching", () => {
  it.each([
    ["kitten", "sitting", 3],
    ["", "abc", 3],
    ["abc", "", 3],
    ["same", "same", 0],
    ["ab", "ba", 2],
  ])("distance %s to %s = %s", (a, b, n) => expect(distance(a, b)).toBe(n));
  it("calculates the documented 90% example", () =>
    expect(similarity("MH12AB1294", "MH12AB1234")).toBe(90));
  it("treats empty input as no match", () =>
    expect(similarity("", "")).toBe(0));
  it("selects the highest score independently of registry ordering", () =>
    expect(
      findBestVehicleMatch("MH12AB1234", [vehicle("MH14CD5678"), vehicle()])
        .best?.vehicle.plate_number,
    ).toBe("MH12AB1234"));
  it("does not round a below-threshold result up", () =>
    expect(evaluateScan("MH12AB1294", [vehicle()], 91, 0, 0).decision).toBe(
      "DENIED",
    ));
  it("grants at the exact configured boundary", () =>
    expect(evaluateScan("MH12XY5678", [vehicle()], 40, 0, 0).decision).toBe(
      "GRANTED",
    ));
  it.each(["BLOCKED", "EXPIRED"] as const)(
    "denies a perfect %s match",
    (status) => {
      const r = evaluateScan(
        "MH12AB1234",
        [vehicle("MH12AB1234", status)],
        60,
        0,
        0,
      );
      expect(r.decision).toBe("DENIED");
      expect(r.reason).toContain(status);
    },
  );
  it("denies a tied best match regardless of statuses", () => {
    const r = evaluateScan(
      "MH12AB1235",
      [vehicle(), vehicle("MH12AB1236", "BLOCKED")],
      60,
      0,
      0,
    );
    expect(r.decision).toBe("DENIED");
    expect(r.reason).toContain("Multiple");
  });
  it("denies an empty registry", () => {
    const r = evaluateScan("MH12AB1234", [], 60, 0, 0);
    expect(r.matched_plate).toBeNull();
    expect(r.decision).toBe("DENIED");
  });
  it("keeps access and risk distinct for repeated denied history", () => {
    const r = evaluateScan("MH12AB1234", [vehicle()], 60, 3, 3);
    expect(r.decision).toBe("GRANTED");
    expect(r.risk_level).toBe("HIGH");
  });
  it("assigns medium risk for repeated scans or moderate similarity", () => {
    expect(evaluateScan("MH12AB1234", [vehicle()], 60, 0, 3).risk_level).toBe(
      "MEDIUM",
    );
    expect(evaluateScan("MH12AB1299", [vehicle()], 60, 0, 0).risk_level).toBe(
      "MEDIUM",
    );
  });
  it("assigns low risk to a clean strong active match", () =>
    expect(evaluateScan("MH12AB1234", [vehicle()], 60, 0, 0).risk_level).toBe(
      "LOW",
    ));
  it("rejects invalid thresholds", () => {
    expect(() => evaluateScan("MH12AB1234", [vehicle()], NaN, 0, 0)).toThrow();
    expect(() => evaluateScan("MH12AB1234", [vehicle()], 0, 0, 0)).toThrow();
  });
});
