package com.helpdesk.controller;

import com.helpdesk.security.JwtUtil;
import com.helpdesk.service.SupabaseService;
import org.mindrot.jbcrypt.BCrypt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.FileWriter;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@RestController
@RequestMapping("/auth")
@SuppressWarnings("unchecked")
public class AuthController {

    @Autowired
    private SupabaseService supabaseService;

    @Autowired
    private JwtUtil jwtUtil;

    private final SecureRandom random = new SecureRandom();

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @PostMapping("/signup")
    public ResponseEntity<Map<String, Object>> signup(@RequestBody Map<String, String> body) {
        String name = body.get("name");
        String email = body.get("email");
        String password = body.get("password");
        String role = body.get("role");

        if (name == null || email == null || password == null || role == null) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Name, email, password, and role are required"));
        }
        if (!email.contains("@")) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Invalid email address"));
        }
        if (password.length() < 6) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Password must be at least 6 characters long"));
        }
        if (!Arrays.asList("customer", "agent").contains(role)) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Invalid role"));
        }

        // Check duplicate email
        Map<String, String> checkFilter = new HashMap<>();
        checkFilter.put("email", "eq." + email);
        List<Map<String, Object>> existing = supabaseService.select("users", "id", checkFilter, null, null, null);
        if (existing != null && !existing.isEmpty()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Collections.singletonMap("error", "User with this email already exists"));
        }

        String passwordHash = BCrypt.hashpw(password, BCrypt.gensalt(10));

        Map<String, Object> insertData = new HashMap<>();
        insertData.put("name", name);
        insertData.put("email", email);
        insertData.put("password_hash", passwordHash);
        insertData.put("role", role);

        Map<String, Object> insertedUser = supabaseService.insert("users", insertData);
        if (insertedUser == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Collections.singletonMap("error", "Failed to create user"));
        }

        Long userId = ((Number) insertedUser.get("id")).longValue();
        String token = jwtUtil.generateToken(userId, email, role);

        Map<String, Object> userMap = new HashMap<>();
        userMap.put("id", userId);
        userMap.put("email", email);
        userMap.put("role", role);

        Map<String, Object> responseMap = new HashMap<>();
        responseMap.put("token", token);
        responseMap.put("user", userMap);

        return ResponseEntity.status(HttpStatus.CREATED).body(responseMap);
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");

        if (email == null || password == null) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Email and password are required"));
        }

        Map<String, String> filter = new HashMap<>();
        filter.put("email", "eq." + email);
        Map<String, Object> user = supabaseService.selectSingle("users", filter);

        if (user == null || !BCrypt.checkpw(password, (String) user.get("password_hash"))) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Collections.singletonMap("error", "Invalid credentials"));
        }

        Long userId = ((Number) user.get("id")).longValue();
        String role = (String) user.get("role");
        String token = jwtUtil.generateToken(userId, email, role);

        Map<String, Object> userMap = new HashMap<>();
        userMap.put("id", userId);
        userMap.put("email", email);
        userMap.put("role", role);

        Map<String, Object> responseMap = new HashMap<>();
        responseMap.put("token", token);
        responseMap.put("user", userMap);

        return ResponseEntity.ok(responseMap);
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, Object>> forgotPassword(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || !email.contains("@")) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Invalid email address"));
        }

        Map<String, Object> genericResponse = new HashMap<>();
        genericResponse.put("success", true);
        genericResponse.put("message", "If an account exists, a verification code has been sent.");

        Map<String, String> filter = new HashMap<>();
        filter.put("email", "eq." + email);
        Map<String, Object> user = supabaseService.selectSingle("users", filter);

        if (user != null) {
            Long userId = ((Number) user.get("id")).longValue();

            // Invalidate any previous OTPs for this user
            Map<String, Object> updatePayload = new HashMap<>();
            updatePayload.put("expires_at", Instant.ofEpochMilli(0).toString());
            Map<String, String> updateFilters = new HashMap<>();
            updateFilters.put("user_id", "eq." + userId);
            updateFilters.put("used", "eq.false");
            supabaseService.update("password_reset_tokens", updatePayload, updateFilters);

            // Generate 6 digit OTP
            int otpVal = 100000 + random.nextInt(900000);
            String otp = String.valueOf(otpVal);
            String otpHash = sha256(otp);
            String expiresAt = Instant.now().plus(10, ChronoUnit.MINUTES).toString();

            Map<String, Object> insertToken = new HashMap<>();
            insertToken.put("user_id", userId);
            insertToken.put("otp_hash", otpHash);
            insertToken.put("expires_at", expiresAt);
            insertToken.put("attempts", 0);
            insertToken.put("verified", false);
            insertToken.put("used", false);

            supabaseService.insert("password_reset_tokens", insertToken);

            System.out.println("[DEV] Password reset OTP generated for testing: " + otp);

            try {
                File devFile = new File("reset_token_dev.json");
                try (FileWriter writer = new FileWriter(devFile)) {
                    writer.write(String.format("{\"email\":\"%s\",\"otp\":\"%s\"}", email, otp));
                }
            } catch (Exception e) {
                System.err.println("Failed to write dev reset token file: " + e.getMessage());
            }
        }

        return ResponseEntity.ok(genericResponse);
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<Map<String, Object>> verifyOtp(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String otp = body.get("otp");

        if (email == null || otp == null || otp.length() != 6) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Email and 6-digit OTP are required"));
        }

        Map<String, String> filter = new HashMap<>();
        filter.put("email", "eq." + email);
        Map<String, Object> user = supabaseService.selectSingle("users", filter);

        if (user == null) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Invalid verification code"));
        }

        Long userId = ((Number) user.get("id")).longValue();

        Map<String, String> tokenFilters = new HashMap<>();
        tokenFilters.put("user_id", "eq." + userId);
        tokenFilters.put("used", "eq.false");
        tokenFilters.put("expires_at", "gt." + Instant.now().toString());
        List<Map<String, Object>> records = supabaseService.select("password_reset_tokens", "*", tokenFilters, "created_at.desc", null, null);

        Map<String, Object> latestToken = null;
        if (records != null) {
            for (Map<String, Object> r : records) {
                if (!(Boolean) r.get("verified")) {
                    latestToken = r;
                    break;
                }
            }
        }

        if (latestToken == null) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Verification code expired or not found"));
        }

        int attempts = ((Number) latestToken.get("attempts")).intValue();
        if (attempts >= 5) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Too many attempts. Please request a new OTP."));
        }

        int newAttempts = attempts + 1;
        Long tokenId = ((Number) latestToken.get("id")).longValue();
        Map<String, Object> updateAttempts = new HashMap<>();
        updateAttempts.put("attempts", newAttempts);
        Map<String, String> idFilter = new HashMap<>();
        idFilter.put("id", "eq." + tokenId);
        supabaseService.update("password_reset_tokens", updateAttempts, idFilter);

        String hashedInputOtp = sha256(otp);
        String dbOtpHash = (String) latestToken.get("otp_hash");

        if (!MessageDigest.isEqual(dbOtpHash.getBytes(StandardCharsets.UTF_8), hashedInputOtp.getBytes(StandardCharsets.UTF_8))) {
            int remaining = 5 - newAttempts;
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Invalid verification code. " + remaining + " attempts remaining."));
        }

        // Generate reset token
        byte[] tokenBytes = new byte[32];
        random.nextBytes(tokenBytes);
        StringBuilder sb = new StringBuilder();
        for (byte b : tokenBytes) {
            sb.append(String.format("%02x", b));
        }
        String resetToken = sb.toString();
        String resetTokenHash = sha256(resetToken);
        String resetExpiresAt = Instant.now().plus(5, ChronoUnit.MINUTES).toString();

        Map<String, Object> updatePayload = new HashMap<>();
        updatePayload.put("verified", true);
        updatePayload.put("reset_token_hash", resetTokenHash);
        updatePayload.put("reset_expires_at", resetExpiresAt);
        supabaseService.update("password_reset_tokens", updatePayload, idFilter);

        try {
            File devFile = new File("reset_token_dev.json");
            if (devFile.exists()) {
                try (FileWriter writer = new FileWriter(devFile)) {
                    writer.write(String.format("{\"email\":\"%s\",\"otp\":\"%s\",\"token\":\"%s\"}", email, otp, resetToken));
                }
            }
        } catch (Exception ignored) {}

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("resetToken", resetToken);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(@RequestBody Map<String, String> body) {
        String resetToken = body.get("resetToken");
        String newPassword = body.get("newPassword");

        if (resetToken == null || newPassword == null) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "resetToken and newPassword are required"));
        }
        if (newPassword.length() < 6) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Password must be at least 6 characters long"));
        }

        String tokenHash = sha256(resetToken);

        Map<String, String> filter = new HashMap<>();
        filter.put("reset_token_hash", "eq." + tokenHash);
        filter.put("verified", "eq.true");
        filter.put("used", "eq.false");
        filter.put("reset_expires_at", "gt." + Instant.now().toString());
        Map<String, Object> record = supabaseService.selectSingle("password_reset_tokens", filter);

        if (record == null) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Invalid, expired, or already used reset token"));
        }

        Long userId = ((Number) record.get("user_id")).longValue();
        Long recordId = ((Number) record.get("id")).longValue();

        String passwordHash = BCrypt.hashpw(newPassword, BCrypt.gensalt(10));

        // Update password
        Map<String, Object> updatePasswordPayload = new HashMap<>();
        updatePasswordPayload.put("password_hash", passwordHash);
        Map<String, String> userFilter = new HashMap<>();
        userFilter.put("id", "eq." + userId);
        supabaseService.update("users", updatePasswordPayload, userFilter);

        // Mark token as used
        Map<String, Object> updateTokenPayload = new HashMap<>();
        updateTokenPayload.put("used", true);
        Map<String, String> tokenFilter = new HashMap<>();
        tokenFilter.put("id", "eq." + recordId);
        supabaseService.update("password_reset_tokens", updateTokenPayload, tokenFilter);

        try {
            File devFile = new File("reset_token_dev.json");
            if (devFile.exists()) {
                devFile.delete();
            }
        } catch (Exception ignored) {}

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Password has been reset successfully");
        return ResponseEntity.ok(response);
    }
}
