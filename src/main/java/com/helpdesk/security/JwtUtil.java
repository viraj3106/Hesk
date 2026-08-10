package com.helpdesk.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.auth0.jwt.interfaces.JWTVerifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    public String generateToken(Long id, String email, String role) {
        Algorithm algorithm = Algorithm.HMAC256(secret);
        return JWT.create()
                .withClaim("id", id)
                .withClaim("email", email)
                .withClaim("role", role)
                .withExpiresAt(new Date(System.currentTimeMillis() + 24 * 60 * 60 * 1000)) // 24 hours
                .sign(algorithm);
    }

    public Map<String, Object> validateToken(String token) {
        try {
            Algorithm algorithm = Algorithm.HMAC256(secret);
            JWTVerifier verifier = JWT.require(algorithm).build();
            DecodedJWT jwt = verifier.verify(token);
            
            Map<String, Object> claims = new HashMap<>();
            claims.put("id", jwt.getClaim("id").asLong() != null ? jwt.getClaim("id").asLong() : (long) jwt.getClaim("id").asInt());
            claims.put("email", jwt.getClaim("email").asString());
            claims.put("role", jwt.getClaim("role").asString());
            return claims;
        } catch (Exception e) {
            return null;
        }
    }
}
