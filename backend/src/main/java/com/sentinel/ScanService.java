package com.sentinel;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.sentinel.Models.*;

@Service
public class ScanService {
    private final SentinelRepository repository; private final GeminiService gemini;
    private final CloudinaryService cloudinary; private final ObjectMapper json;
    public ScanService(SentinelRepository repository,GeminiService gemini,CloudinaryService cloudinary,ObjectMapper json) {
        this.repository=repository; this.gemini=gemini; this.cloudinary=cloudinary; this.json=json;
    }
    @Transactional(timeout=90)
    public Map<String,Object> scan(UUID operator,ScanInput input) {
        repository.lockOperator(operator);
        var existing=repository.existing(input.requestId(),operator);
        if(existing.isPresent()) return existing.get();
        var settings=repository.settings();
        String plate,raw,source="MANUAL",imagePath=null,imageFormat=null; Double confidence=null;
        if(input.mode().equals("manual")) {
            raw=input.plate();
            if(raw==null || raw.length()>40) throw new ApiException(400,"PLATE","Enter a valid plate number.");
            plate=PlateRules.normalize(raw);
        } else {
            validateImage(input.image(),input.mime());
            if(input.ocrText()==null || input.ocrText().length()>4000 || input.ocrConfidence()==null || !Double.isFinite(input.ocrConfidence()) || input.ocrConfidence()<0 || input.ocrConfidence()>100)
                throw new ApiException(400,"OCR","OCR output is invalid. Please rescan the image.");
            raw=input.ocrText(); confidence=input.ocrConfidence();
            plate=PlateRules.reliablePlate(raw,confidence,settings.ocr_confidence_threshold());
            if(plate==null) { plate=gemini.readPlate(input.image(),input.mime()); source="GEMINI_VISION"; }
            else source="TESSERACT";
        }
        if(!PlateRules.valid(plate)) throw new ApiException(400,"PLATE","Use 5–12 letters and digits, including at least one of each.");
        int[] recent=repository.recent(plate);
        var result=PlateRules.evaluate(plate,repository.allVehicles(),settings.similarity_threshold(),recent[1],recent[0]);
        if(input.mode().equals("image")) {
            var evidence=cloudinary.upload(input.image(),input.mime(),"sentinel/"+operator+"/"+input.requestId());
            imagePath=evidence.publicId(); imageFormat=evidence.format();
        }
        Map<String,Object> row=json.convertValue(result,new TypeReference<LinkedHashMap<String,Object>>(){});
        row.put("log_id",UUID.randomUUID()); row.put("request_id",input.requestId()); row.put("operator_id",operator);
        row.put("detected_text",raw); row.put("detected_plate",plate); row.put("source",source); row.put("ocr_confidence",confidence);
        row.put("image_path",imagePath); row.put("image_format",imageFormat);
        // Deterministic evidence ID survives failed DB inserts; retry reuses the authenticated asset.
        return repository.insertIncident(row);
    }
    static void validateImage(String encoded,String mime) {
        if(encoded==null || mime==null || !List.of("image/jpeg","image/png","image/webp").contains(mime)) throw new ApiException(400,"IMAGE","Upload a JPEG, PNG, or WebP image.");
        byte[] bytes;
        try { bytes=Base64.getDecoder().decode(encoded); } catch(IllegalArgumentException e) { throw new ApiException(400,"IMAGE","Image data is invalid."); }
        if(bytes.length<12 || bytes.length>5*1024*1024) throw new ApiException(400,"IMAGE","Upload a valid image smaller than 5 MB.");
        boolean valid=switch(mime) {
            case "image/jpeg" -> (bytes[0]&255)==255 && (bytes[1]&255)==216 && (bytes[2]&255)==255;
            case "image/png" -> Arrays.equals(Arrays.copyOf(bytes,8),new byte[]{(byte)137,80,78,71,13,10,26,10});
            default -> new String(bytes,0,4,java.nio.charset.StandardCharsets.US_ASCII).equals("RIFF") && new String(bytes,8,4,java.nio.charset.StandardCharsets.US_ASCII).equals("WEBP");
        };
        if(!valid) throw new ApiException(400,"IMAGE","Image contents do not match the selected format.");
    }
}
