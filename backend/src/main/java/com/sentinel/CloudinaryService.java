package com.sentinel;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class CloudinaryService {
    private final HttpClient http; private final ObjectMapper json;
    private final String cloud,key,secret,baseUrl;
    public CloudinaryService(HttpClient http,ObjectMapper json,@Value("${sentinel.cloudinary-cloud}") String cloud,
        @Value("${sentinel.cloudinary-key}") String key,@Value("${sentinel.cloudinary-secret}") String secret,
        @Value("${sentinel.cloudinary-base-url:https://api.cloudinary.com/v1_1}") String baseUrl) {
        this.http=http; this.json=json; this.cloud=cloud.trim(); this.key=key.trim(); this.secret=secret.trim(); this.baseUrl=baseUrl;
    }
    public boolean configured() { return !cloud.isBlank() && !key.isBlank() && !secret.isBlank(); }
    private void requireConfig() { if(!configured()) throw new ApiException(503,"STORAGE","Image storage is not configured. Contact your administrator."); }
    static String signature(Map<String,String> params,String secret) {
        try {
            String plain=new TreeMap<>(params).entrySet().stream().map(e -> e.getKey()+"="+e.getValue()).collect(Collectors.joining("&"))+secret;
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(plain.getBytes(StandardCharsets.UTF_8)));
        } catch(Exception e) { throw new IllegalStateException("Signing unavailable"); }
    }
    private static String encode(String value) { return URLEncoder.encode(value,StandardCharsets.UTF_8); }
    private static String form(Map<String,String> fields) { return fields.entrySet().stream().map(e -> encode(e.getKey())+"="+encode(e.getValue())).collect(Collectors.joining("&")); }
    public record Evidence(String publicId,String format) {}
    public Evidence upload(String image,String mime,String publicId) {
        requireConfig();
        Map<String,String> fields=new LinkedHashMap<>(Map.of("timestamp",Long.toString(Instant.now().getEpochSecond()),"public_id",publicId,"type","authenticated","overwrite","false"));
        fields.put("signature",signature(fields,secret)); fields.put("api_key",key); fields.put("file","data:"+mime+";base64,"+image);
        try {
            var request=HttpRequest.newBuilder(URI.create(baseUrl+"/"+encode(cloud)+"/image/upload")).timeout(Duration.ofSeconds(30))
                .header("Content-Type","application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString(form(fields))).build();
            var response=http.send(request,HttpResponse.BodyHandlers.ofString());
            if(response.statusCode()<200 || response.statusCode()>=300) {
                String message="Cloudinary could not store the image. Please retry.",code="STORAGE";
                if(response.statusCode()==403) { code="STORAGE_PERMISSION"; message="The Cloudinary API key cannot upload images. Enable create/upload permission in Cloudinary."; }
                else if(response.statusCode()==401) { code="STORAGE_AUTH"; message="Cloudinary could not authenticate the upload. Check the configured cloud name, API key, and API secret."; }
                else if(response.statusCode()==429) { code="STORAGE_LIMIT"; message="Cloudinary has reached an upload limit. Wait before retrying or check the account quota."; }
                throw new ApiException(503,code,message);
            }
            var data=json.readTree(response.body());
            if(!publicId.equals(data.path("public_id").asText()) || !data.path("format").asText().matches("[a-zA-Z0-9]{1,10}")) throw new ApiException(503,"STORAGE","Image storage returned an invalid response.");
            return new Evidence(publicId,data.path("format").asText());
        } catch(ApiException e) { throw e; }
        catch(InterruptedException e) { Thread.currentThread().interrupt(); throw new ApiException(503,"STORAGE","Image upload timed out. Please retry."); }
        catch(Exception e) { throw new ApiException(503,"STORAGE","Cloudinary could not store the image. Please retry."); }
    }
    public String evidenceUrl(String publicId,String format) {
        requireConfig(); long now=Instant.now().getEpochSecond();
        Map<String,String> fields=new LinkedHashMap<>(Map.of("public_id",publicId,"format",format,"type","authenticated","timestamp",Long.toString(now),"expires_at",Long.toString(now+120)));
        fields.put("signature",signature(fields,secret)); fields.put("api_key",key);
        return baseUrl+"/"+encode(cloud)+"/image/download?"+form(fields);
    }
}
