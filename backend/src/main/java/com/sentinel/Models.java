package com.sentinel;

import jakarta.validation.constraints.*;
import java.util.List;
import java.util.UUID;

public final class Models {
    private Models() {}
    public record Vehicle(UUID vehicle_id, String plate_number, String owner_name, String vehicle_type, String status, String created_at) {}
    public record VehicleInput(@NotBlank @Size(max=40) String plate_number,
        @NotBlank @Size(min=2,max=100) String owner_name,
        @NotNull @Pattern(regexp="Car|Motorcycle|Truck|Bus|Other") String vehicle_type,
        @NotNull @Pattern(regexp="ACTIVE|BLOCKED|EXPIRED") String status) {}
    public record Settings(boolean id, int similarity_threshold, int ocr_confidence_threshold) {}
    public record SettingsInput(@NotNull @Min(1) @Max(100) Integer similarity_threshold,
        @NotNull @Min(1) @Max(100) Integer ocr_confidence_threshold) {}
    public record ScanInput(@NotNull UUID requestId, @NotNull @Pattern(regexp="manual|image") String mode,
        @Size(max=40) String plate, @Size(max=6990508) String image, String mime,
        @Size(max=4000) String ocrText, @DecimalMin("0") @DecimalMax("100") Double ocrConfidence) {}
    public record IncidentInput(@NotNull UUID incidentId) {}
    public record Page<T>(List<T> data, long count) {}
    public record Decision(String matched_plate, String vehicle_status, double similarity_score, Integer edit_distance,
        int threshold, String decision, String reason, String risk_level, List<String> risk_reasons,
        int previous_incident_count, int previous_denied_count) {}
}
