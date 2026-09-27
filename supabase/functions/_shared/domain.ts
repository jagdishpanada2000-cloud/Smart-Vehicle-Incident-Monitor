// Shared by the browser (display/validation) and Edge Functions (authoritative decisions).
export type VehicleStatus = "ACTIVE" | "BLOCKED" | "EXPIRED";
export type Risk = "LOW" | "MEDIUM" | "HIGH";
export interface Vehicle {
  vehicle_id: string;
  plate_number: string;
  owner_name: string;
  vehicle_type: string;
  status: VehicleStatus;
  created_at: string;
}
export function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
export function isValidPlate(value: string): boolean {
  return (
    /^[A-Z0-9]{5,12}$/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value)
  );
}
// Conservative recognition gate for standard Indian state and BH registrations.
export function extractPlateCandidates(text: string): string[] {
  const pattern =
    /\b(?:[A-Z]{2}[\s-]*\d{1,2}[\s-]*[A-Z]{1,3}[\s-]*\d{4}|\d{2}[\s-]*BH[\s-]*\d{4}[\s-]*[A-Z]{1,2})\b/g;
  return [
    ...new Set((text.toUpperCase().match(pattern) || []).map(normalizePlate)),
  ];
}
export function assessOcr(text: string, confidence: number, minimum: number) {
  const candidates = extractPlateCandidates(text);
  return {
    candidates,
    plate: candidates.length === 1 ? candidates[0] : null,
    reliable:
      Number.isFinite(confidence) &&
      confidence >= minimum &&
      candidates.length === 1,
  };
}
export function calculateLevenshteinDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++)
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    previous = current;
  }
  return previous[b.length];
}
export function calculateSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  return (
    (1 - calculateLevenshteinDistance(a, b) / Math.max(a.length, b.length)) *
    100
  );
}
export function findBestVehicleMatch(plate: string, vehicles: Vehicle[]) {
  const ranked = vehicles
    .map((vehicle) => ({
      vehicle,
      similarity: calculateSimilarity(plate, vehicle.plate_number),
      distance: calculateLevenshteinDistance(plate, vehicle.plate_number),
    }))
    .sort(
      (a, b) =>
        b.similarity - a.similarity ||
        a.vehicle.plate_number.localeCompare(b.vehicle.plate_number),
    );
  return {
    best: ranked[0] ?? null,
    ambiguous:
      ranked.length > 1 &&
      Math.abs(ranked[0].similarity - ranked[1].similarity) < 1e-9,
  };
}
export function evaluateScan(
  plate: string,
  vehicles: Vehicle[],
  threshold: number,
  previousDenied: number,
  previousScans: number,
) {
  if (
    !isValidPlate(plate) ||
    !Number.isFinite(threshold) ||
    threshold < 1 ||
    threshold > 100
  )
    throw new Error("Invalid scan input");
  const { best, ambiguous } = findBestVehicleMatch(plate, vehicles);
  const similarity = best?.similarity ?? 0;
  let reason: string;
  let decision: "GRANTED" | "DENIED" = "DENIED";
  if (!best) reason = "No registered vehicles are available for comparison.";
  else if (similarity < threshold)
    reason = `Best match ${similarity.toFixed(1)}% is below the ${threshold}% threshold.`;
  else if (ambiguous)
    reason =
      "Multiple vehicles share the best score. Manual verification is required.";
  else if (best.vehicle.status !== "ACTIVE")
    reason = `Vehicle matched at ${similarity.toFixed(1)}%, but is ${best.vehicle.status}.`;
  else {
    decision = "GRANTED";
    reason = `Active vehicle matched at ${similarity.toFixed(1)}%, meeting the ${threshold}% threshold.`;
  }
  const riskReasons: string[] = [];
  let risk: Risk = "LOW";
  if (decision === "DENIED" || previousDenied >= 3) {
    risk = "HIGH";
    if (decision === "DENIED") riskReasons.push(reason);
    if (previousDenied >= 3)
      riskReasons.push(
        `${previousDenied} denied attempts for this exact detected plate in the last 24 hours.`,
      );
  } else if (similarity < 85 || previousDenied > 0 || previousScans >= 3) {
    risk = "MEDIUM";
    if (similarity < 85)
      riskReasons.push("Similarity is below the strong-match level of 85%.");
    if (previousDenied > 0)
      riskReasons.push(
        `${previousDenied} previous denied attempts in 24 hours.`,
      );
    if (previousScans >= 3)
      riskReasons.push(`${previousScans} previous scans in 24 hours.`);
  } else
    riskReasons.push(
      "Strong match, active registration, and no recent denied attempts.",
    );
  return {
    matched_plate: best?.vehicle.plate_number ?? null,
    vehicle_status: best?.vehicle.status ?? null,
    similarity_score: similarity,
    edit_distance: best?.distance ?? null,
    threshold,
    decision,
    reason,
    risk_level: risk,
    risk_reasons: riskReasons,
    previous_incident_count: previousScans,
    previous_denied_count: previousDenied,
  };
}
