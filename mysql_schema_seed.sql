-- ResolveDesk Schema & Demonstration Seed Data for MySQL 8.x
-- Database creation (optional / safe)
CREATE DATABASE IF NOT EXISTS `resolvedesk` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `resolvedesk`;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('customer', 'agent', 'admin')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    assigned_agent_id BIGINT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    priority VARCHAR(50) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'resolved', 'closed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    resolved_at DATETIME NULL,
    CONSTRAINT fk_tickets_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_tickets_agent FOREIGN KEY (assigned_agent_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Ticket Responses Table
CREATE TABLE IF NOT EXISTS responses (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticket_id BIGINT NOT NULL,
    sender_id BIGINT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_responses_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_responses_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    reset_token_hash VARCHAR(255) NULL,
    expires_at DATETIME NOT NULL,
    reset_expires_at DATETIME NULL,
    attempts INT DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    used BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Ticket Status History Table
CREATE TABLE IF NOT EXISTS ticket_status_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticket_id BIGINT NOT NULL,
    old_status VARCHAR(50) NULL,
    new_status VARCHAR(50) NOT NULL,
    changed_by BIGINT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_history_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_history_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Seed Demonstration Users (Passwords: Admin123!, Agent123!, Customer123!)
INSERT INTO users (id, name, email, password_hash, role)
VALUES 
  (1, 'System Admin', 'admin@helpdesk.com', '$2a$10$BWpwMSEz6viYQvbbCpAA7.q999mvdW.mHW0aXNbTpa4LQdlfu5gGq', 'admin'),
  (2, 'Sarah Jenkins (Agent)', 'agent@helpdesk.com', '$2a$10$BWpwMSEz6viYQvbbCpAA7.BbX882d4m/HeMTdtjw4mmkVscSQ5TZa', 'agent'),
  (3, 'Alex Mercer (Customer)', 'customer@helpdesk.com', '$2a$10$BWpwMSEz6viYQvbbCpAA7.QL1Yb6Q2KqDmcTphVXjQHH62SPdvgli', 'customer')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 7. Seed Sample Demonstration Tickets
INSERT INTO tickets (id, customer_id, assigned_agent_id, title, description, category, priority, status, created_at, updated_at)
VALUES
  (1, 3, NULL, 'Payment Gateway Timeout during Checkout', 'Customer transactions fail at 3DS verification step with gateway timeout error.', 'Billing', 'high', 'open', NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY),
  (2, 3, 2, 'API Rate Limiting 429 Errors in Production', 'We are observing elevated 429 Too Many Requests errors on the v1/tickets endpoint.', 'Technical', 'high', 'in_progress', NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 12 HOUR),
  (3, 3, 2, 'Dark Mode Contrast Issue in Settings Menu', 'Navigation text is low contrast when switching to dark theme on Firefox.', 'UI/UX', 'low', 'resolved', NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 1 DAY)
ON DUPLICATE KEY UPDATE title=VALUES(title);

-- 8. Seed Sample Responses
INSERT INTO responses (ticket_id, sender_id, message, created_at)
VALUES
  (2, 2, 'Investigating the API rate limits on our gateway proxy right now.', NOW() - INTERVAL 10 HOUR),
  (3, 2, 'Contrast fixed in stylesheet release v1.2.', NOW() - INTERVAL 1 DAY)
ON DUPLICATE KEY UPDATE message=VALUES(message);
