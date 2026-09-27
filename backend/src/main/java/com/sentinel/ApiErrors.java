package com.sentinel;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiErrors {
    private static final Logger log = LoggerFactory.getLogger(ApiErrors.class);
    @ExceptionHandler(ApiException.class)
    ResponseEntity<?> known(ApiException e) { return response(e.status, e.code, e.getMessage()); }
    @ExceptionHandler(DuplicateKeyException.class)
    ResponseEntity<?> duplicate() { return response(409, "CONFLICT", "This plate or request is already registered."); }
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class, IllegalArgumentException.class})
    ResponseEntity<?> invalid() { return response(400, "INPUT", "The request contains invalid fields."); }
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<?> database(DataAccessException e) {
        log.warn("Database operation failed: {}", e.getMessage(), e);
        return response(503, "DATABASE", "The database is unavailable. Check the backend database configuration.");
    }
    @ExceptionHandler(Exception.class)
    ResponseEntity<?> unexpected(Exception e) {
        log.error("Request failed: {}", e.getClass().getSimpleName());
        return response(500, "INTERNAL", "The request could not be completed. Please retry.");
    }
    private ResponseEntity<?> response(int status, String code, String error) {
        return ResponseEntity.status(status).body(Map.of("error", error, "code", code));
    }
}
