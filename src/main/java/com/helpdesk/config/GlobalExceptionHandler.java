package com.helpdesk.config;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;

import java.util.Collections;
import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceAccessException.class)
    public ResponseEntity<Map<String, String>> handleNetworkException(ResourceAccessException ex) {
        String msg = "Database connection error: Could not reach Supabase endpoint. Please verify SUPABASE_URL and SUPABASE_SECRET_KEY in your environment.";
        System.err.println("[GlobalExceptionHandler] " + msg + " Details: " + ex.getMessage());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Collections.singletonMap("error", msg));
    }

    @ExceptionHandler(RestClientResponseException.class)
    public ResponseEntity<Map<String, String>> handleRestClientException(RestClientResponseException ex) {
        String msg = "Database API returned status " + ex.getRawStatusCode() + ": " + ex.getResponseBodyAsString();
        System.err.println("[GlobalExceptionHandler] " + msg);
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(Collections.singletonMap("error", "Database operation failed. Verify Supabase credentials."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGeneralException(Exception ex) {
        System.err.println("[GlobalExceptionHandler] Unhandled exception: " + ex.getMessage());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Collections.singletonMap("error", ex.getMessage() != null ? ex.getMessage() : "An unexpected server error occurred."));
    }
}
