package com.sentinel;

import jakarta.validation.Valid;
import java.time.Instant;
import java.util.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import static com.sentinel.Models.*;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final SentinelRepository repository; private final ScanService scans;
    private final GeminiService gemini; private final CloudinaryService cloudinary;
    public ApiController(SentinelRepository repository,ScanService scans,GeminiService gemini,CloudinaryService cloudinary) {
        this.repository=repository; this.scans=scans; this.gemini=gemini; this.cloudinary=cloudinary;
    }
    private UUID user(Authentication auth) { return UUID.fromString(auth.getName()); }
    private void page(int page,int size) { if(page<0 || page>100000 || size<1 || size>100) throw new ApiException(400,"INPUT","Invalid page or page size."); }
    private void choice(String value,String... choices) { if(!value.isEmpty() && !List.of(choices).contains(value)) throw new ApiException(400,"INPUT","Invalid filter."); }
    @GetMapping("/health") public Map<String,String> health() { return Map.of("status","UP","service","sentinel-api"); }
    @GetMapping("/me") public Map<String,Object> me(Authentication auth) { return Map.of("user_id",auth.getName(),"operator",auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_OPERATOR"))); }
    @GetMapping("/vehicles") public Page<Vehicle> vehicles(@RequestParam(defaultValue="") String search,@RequestParam(defaultValue="") String status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="12") int size) {
        page(page,size); choice(status,"ACTIVE","BLOCKED","EXPIRED"); return repository.vehicles(search,status,page,size);
    }
    @PostMapping("/vehicles") public Vehicle create(@Valid @RequestBody VehicleInput input) { return repository.saveVehicle(null,input); }
    @PutMapping("/vehicles/{id}") public Vehicle update(@PathVariable UUID id,@Valid @RequestBody VehicleInput input) { return repository.saveVehicle(id,input); }
    @DeleteMapping("/vehicles/{id}") public Map<String,Boolean> delete(@PathVariable UUID id) { repository.deleteVehicle(id); return Map.of("deleted",true); }
    @GetMapping("/settings") public Settings settings() { return repository.settings(); }
    @PutMapping("/settings") public Settings settings(@Valid @RequestBody SettingsInput input) { return repository.saveSettings(input); }
    @GetMapping("/incidents") public Page<Map<String,Object>> incidents(@RequestParam(defaultValue="") String search,@RequestParam(defaultValue="") String decision,@RequestParam(defaultValue="") String risk,@RequestParam(defaultValue="false") boolean ascending,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="15") int size) {
        page(page,size); choice(decision,"GRANTED","DENIED"); choice(risk,"LOW","MEDIUM","HIGH"); return repository.incidents(search,decision,risk,ascending,page,size);
    }
    @GetMapping("/incidents/{id}") public Map<String,Object> incident(@PathVariable UUID id) { return repository.incident(id); }
    @GetMapping("/overview") public Map<String,Object> overview() { return Map.of("stats",repository.stats(),"days",repository.days(),"incidents",repository.incidents("","","",false,0,6).data()); }
    @PostMapping("/process-scan") public Map<String,Object> scan(Authentication auth,@Valid @RequestBody ScanInput input) {
        var existing=repository.existing(input.requestId(),user(auth));
        if(existing.isPresent()) return Map.of("incident",existing.get());
        repository.consume(user(auth),"scan",10);
        return Map.of("incident",scans.scan(user(auth),input));
    }
    @PostMapping("/ai-analysis") public Map<String,Object> analyze(Authentication auth,@Valid @RequestBody IncidentInput input) {
        var incident=repository.incident(input.incidentId());
        if("complete".equals(incident.get("ai_status"))) return Map.of("incident",incident);
        repository.consume(user(auth),"analyst",10);
        try { return Map.of("incident",repository.summary(input.incidentId(),gemini.summarize(incident),"complete")); }
        catch(ApiException e) {
            return Map.of("incident",repository.summary(input.incidentId(),null,"unavailable"),"warning","AI explanation is unavailable. The saved access decision is unchanged.");
        }
    }
    @PostMapping("/evidence-url") public Map<String,Object> evidence(Authentication auth,@Valid @RequestBody IncidentInput input) {
        repository.consume(user(auth),"evidence",30); var row=repository.incident(input.incidentId());
        if(!(row.get("image_path") instanceof String path) || !(row.get("image_format") instanceof String format)) throw new ApiException(404,"NOT_FOUND","This incident has no stored image.");
        return Map.of("url",cloudinary.evidenceUrl(path,format),"expiresIn",120);
    }
    @PostMapping("/health-check") public Map<String,String> checks() {
        repository.settings();
        return Map.of("frontend","ONLINE","supabase","ONLINE","database","ONLINE","backend","ONLINE","ocr","TESSERACT_BROWSER","gemini",gemini.configured()?"CONFIGURED":"MISSING_KEY","cloudinary",cloudinary.configured()?"CONFIGURED":"MISSING_KEY","matching","ONLINE","checked_at",Instant.now().toString());
    }
}
