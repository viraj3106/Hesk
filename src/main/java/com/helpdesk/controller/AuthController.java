package com.helpdesk.controller;

import com.helpdesk.entity.PasswordResetToken;
import com.helpdesk.entity.User;
import com.helpdesk.repository.PasswordResetTokenRepository;
import com.helpdesk.repository.UserRepository;
import com.helpdesk.security.JwtUtil;
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
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

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
        if (!Arrays.asList("customer", "agent", "admin").contains(role)) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Invalid role"));
        }

        if (userRepository.existsByEmail(email)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Collections.singletonMap("error", "User with this email already exists"));
        }

        String passwordHash = BCrypt.hashpw(password, BCrypt.gensalt(10));
        User user = new User(name, email, passwordHash, role);
        user = userRepository.save(user);

        String token = jwtUtil.generateToken(user.getId(), email, role);

        Map<String, Object> userMap = new HashMap<>();
        userMap.put("id", user.getId());
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

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (!userOpt.isPresent() || !BCrypt.checkpw(password, userOpt.get().getPasswordHash())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Collections.singletonMap("error", "Invalid credentials"));
        }

        User user = userOpt.get();
        String token = jwtUtil.generateToken(user.getId(), email, user.getRole());

        Map<String, Object> userMap = new HashMap<>();
        userMap.put("id", user.getId());
        userMap.put("email", email);
        userMap.put("role", user.getRole());

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

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            User user = userOpt.get();

            // Invalidate previous OTPs for this user
            List<PasswordResetToken> oldTokens = passwordResetTokenRepository.findByUserIdAndUsedFalse(user.getId());
            for (PasswordResetToken t : oldTokens) {
                t.setExpiresAt(new Date(0));
            }
            passwordResetTokenRepository.saveAll(oldTokens);

            // Generate 6 digit OTP
            int otpVal = 100000 + random.nextInt(900000);
            String otp = String.valueOf(otpVal);
            String otpHash = sha256(otp);
            Date expiresAt = Date.from(Instant.now().plus(10, ChronoUnit.MINUTES));

            PasswordResetToken tokenRecord = new PasswordResetToken();
            tokenRecord.setUserId(user.getId());
            tokenRecord.setOtpHash(otpHash);
            tokenRecord.setExpiresAt(expiresAt);
            tokenRecord.setAttempts(0);
            tokenRecord.setVerified(false);
            tokenRecord.setUsed(false);
            passwordResetTokenRepository.save(tokenRecord);

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

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (!userOpt.isPresent()) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Invalid verification code"));
        }

        User user = userOpt.get();
        List<PasswordResetToken> records = passwordResetTokenRepository.findByUserIdAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(user.getId(), new Date());

        PasswordResetToken latestToken = null;
        for (PasswordResetToken r : records) {
            if (!Boolean.TRUE.equals(r.getVerified())) {
                latestToken = r;
                break;
            }
        }

        if (latestToken == null) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Verification code expired or not found"));
        }

        int attempts = latestToken.getAttempts() != null ? latestToken.getAttempts() : 0;
        if (attempts >= 5) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Too many attempts. Please request a new OTP."));
        }

        int newAttempts = attempts + 1;
        latestToken.setAttempts(newAttempts);
        passwordResetTokenRepository.save(latestToken);

        String hashedInputOtp = sha256(otp);
        String dbOtpHash = latestToken.getOtpHash();

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
        Date resetExpiresAt = Date.from(Instant.now().plus(5, ChronoUnit.MINUTES));

        latestToken.setVerified(true);
        latestToken.setResetTokenHash(resetTokenHash);
        latestToken.setResetExpiresAt(resetExpiresAt);
        passwordResetTokenRepository.save(latestToken);

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
        Optional<PasswordResetToken> tokenOpt = passwordResetTokenRepository.findByResetTokenHashAndVerifiedTrueAndUsedFalseAndResetExpiresAtAfter(tokenHash, new Date());

        if (!tokenOpt.isPresent()) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Invalid, expired, or already used reset token"));
        }

        PasswordResetToken tokenRecord = tokenOpt.get();
        Optional<User> userOpt = userRepository.findById(tokenRecord.getUserId());
        if (!userOpt.isPresent()) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "User not found"));
        }

        User user = userOpt.get();
        String passwordHash = BCrypt.hashpw(newPassword, BCrypt.gensalt(10));
        user.setPasswordHash(passwordHash);
        userRepository.save(user);

        tokenRecord.setUsed(true);
        passwordResetTokenRepository.save(tokenRecord);

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
