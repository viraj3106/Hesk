-- ResolveDesk Schema & Demonstration Seed Data for Supabase PostgreSQL

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('customer', 'agent', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_agent_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    priority VARCHAR(50) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Ticket Responses Table
CREATE TABLE IF NOT EXISTS ticket_responses (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    otp_hash VARCHAR(255) NOT NULL,
    reset_token_hash VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reset_expires_at TIMESTAMP WITH TIME ZONE,
    attempts INT DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Seed Demonstration Users (Passwords: Admin123!, Agent123!, Customer123!)
INSERT INTO users (name, email, password_hash, role)
VALUES 
  ('System Admin', 'admin@helpdesk.com', '$2a$10$BWpwMSEz6viYQvbbCpAA7.q999mvdW.mHW0aXNbTpa4LQdlfu5gGq', 'admin'),
  ('Sarah Jenkins (Agent)', 'agent@helpdesk.com', '$2a$10$BWpwMSEz6viYQvbbCpAA7.BbX882d4m/HeMTdtjw4mmkVscSQ5TZa', 'agent'),
  ('Alex Mercer (Customer)', 'customer@helpdesk.com', '$2a$10$BWpwMSEz6viYQvbbCpAA7.QL1Yb6Q2KqDmcTphVXjQHH62SPdvgli', 'customer')
ON CONFLICT (email) DO NOTHING;

-- 6. Seed Sample Demonstration Tickets
INSERT INTO tickets (customer_id, title, description, category, priority, status)
SELECT u.id, 'Payment Gateway Timeout during Checkout', 'Customer transactions fail at 3DS verification step with gateway timeout error.', 'Billing', 'high', 'open'
FROM users u WHERE u.email = 'customer@helpdesk.com'
LIMIT 1;

INSERT INTO tickets (customer_id, assigned_agent_id, title, description, category, priority, status)
SELECT c.id, a.id, 'API Rate Limiting 429 Errors in Production', 'We are observing elevated 429 Too Many Requests errors on the v1/tickets endpoint.', 'Technical', 'high', 'in_progress'
FROM users c, users a 
WHERE c.email = 'customer@helpdesk.com' AND a.email = 'agent@helpdesk.com'
LIMIT 1;

INSERT INTO tickets (customer_id, assigned_agent_id, title, description, category, priority, status)
SELECT c.id, a.id, 'Dark Mode Contrast Issue in Settings Menu', 'Navigation text is low contrast when switching to dark theme on Firefox.', 'UI/UX', 'low', 'resolved'
FROM users c, users a 
WHERE c.email = 'customer@helpdesk.com' AND a.email = 'agent@helpdesk.com'
LIMIT 1;
