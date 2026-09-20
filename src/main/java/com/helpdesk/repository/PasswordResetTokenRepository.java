package com.helpdesk.repository;

import com.helpdesk.entity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;
import java.util.Optional;

@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {
    List<PasswordResetToken> findByUserIdAndUsedFalse(Long userId);
    List<PasswordResetToken> findByUserIdAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(Long userId, Date now);
    Optional<PasswordResetToken> findByResetTokenHashAndVerifiedTrueAndUsedFalseAndResetExpiresAtAfter(String resetTokenHash, Date now);
}
