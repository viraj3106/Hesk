# ResolveDesk 🎫

> Every issue deserves an owner. Every conversation deserves a history. Every resolution deserves a closed loop.

**ResolveDesk** is a clean, role-based customer support and ticket resolution platform designed to streamline issue tracking, assignment, communication, and resolution. Built as a fully-featured Node.js and Express backend backed by Supabase (Postgres) and a lightweight vanilla JS/CSS frontend, it ensures that no customer request gets lost in the noise.

---

## 👋 Why ResolveDesk?

Imagine a customer reports a critical bug. Someone says they'll "look into it." A few days pass, and nobody remembers who took ownership, what details were discussed, or whether the problem was actually fixed. Meanwhile, the customer is left in the dark.

**ResolveDesk fixes this.** It eliminates the ambiguity of ticket ownership and status by transforming every support request into a structured ticket.

Every ticket on ResolveDesk is tracked with:
- 👤 **Clear ownership:** Automatically mapped to the submitting customer and assigned agent.
- 🏷️ **Categorization & Priority:** Categorized by topic and flagged with a priority level (`low`, `medium`, `high`) to manage SLAs.
- 🔄 **Strict State Transitions:** A legal state machine ensures tickets progress systematically (from open to assigned, to in-progress, to resolved, and finally closed).
- 💬 **A Living Thread:** A chronological, real-time message stream between the customer and the assigned agent.
- 🔁 **Resolution History:** Reopening rules allow customers to kick a ticket back to `in_progress` if they aren't satisfied with the solution, complete with automated thread logs.

---

## 🎯 What does ResolveDesk do?

ResolveDesk organizes the entire support lifecycle into three key roles:

```
[ Customer ] ──( Creates ticket )──► [ Admin ] ──( Assigns Agent )──► [ Agent ]
     ▲                                                                   │
     │                                                                   ▼
[ Customer ] ◄──( Reviews & Closes/Reopens )── [ Agent ] ◄──( Works & Responds )
```

- **Customers:** Register, submit tickets, converse directly with agents in their dedicated ticket thread, and close or reopen tickets based on satisfaction.
- **Agents:** Access a paginated queue of assigned tickets, update statuses, converse with customers, and mark issues as resolved.
- **Admins:** View overall system analytics (average resolution time, workload breakdown, priority counts), monitor the master ticket stream, and assign unassigned tickets to agents based on workload.

---

## 🔄 How the system works

The ticket lifecycle follows a strict transition flow validated on the server. If a ticket tries to jump steps or change without an assigned agent, the API rejects it.

```mermaid
flowchart TD
    A[Customer Creates Ticket] -->|Status: open| B(Open)
    B -->|Admin Assigns Agent| C(Assigned)
    C -->|Agent Starts Work| D(In Progress)
    D -->|Agent Resolves Ticket| E(Resolved)
    E -->|Customer Satisfied? Yes| F(Closed)
    E -->|Customer Reopens Ticket| D
    F -->|Customer Reopens Ticket| D

    style B fill:#f9f,stroke:#333,stroke-width:2px
    style C fill:#bbf,stroke:#333,stroke-width:2px
    style D fill:#fbf,stroke:#333,stroke-width:2px
    style E fill:#bfb,stroke:#333,stroke-width:2px
    style F fill:#ddd,stroke:#333,stroke-width:2px
```

---

## 🛠️ The Tech Stack

ResolveDesk is built with a lightweight, high-performance tech stack focused on reliability and real-world scalability:

- **Backend:** Node.js & Express
- **Database:** Supabase (PostgreSQL)
- **Security & Auth:** JSON Web Tokens (JWT) & bcryptjs password hashing
- **Frontend:** Vanilla HTML5, CSS3 (Modern dark-themed system), and ES6 JavaScript
- **API Styling:** RESTful JSON endpoints with Role-Based Access Control (RBAC) middleware

---

## 📂 Project Architecture

Here's a quick map of the repository's layout:

- `server.js` — The core Express application containing the RBAC logic, state machine, analytics aggregators, and authentication controllers.
- `database.js` — Supabase client configuration and initialization.
- [middleware/](file:///v:/capstone%20prj/middleware/) — Custom middleware including [auth.js](file:///v:/capstone%20prj/middleware/auth.js) for JWT validation and role requirements.
- [public/](file:///v:/capstone%20prj/public/) — Frontend client codebase.
  - [index.html](file:///v:/capstone%20prj/public/index.html) — Portal login and sign-up interface.
  - [customer-dashboard.html](file:///v:/capstone%20prj/public/customer-dashboard.html) — Ticket creation and personal list view.
  - [agent-queue.html](file:///v:/capstone%20prj/public/agent-queue.html) — Work queue for assigned support staff.
  - [admin-dashboard.html](file:///v:/capstone%20prj/public/admin-dashboard.html) — Workload sorting, agent assignment, and system stats.
  - [ticket-detail.html](file:///v:/capstone%20prj/public/ticket-detail.html) — The interactive communication hub for any single ticket.
  - [api.js](file:///v:/capstone%20prj/public/api.js) — Shared fetch-based abstraction layer mapping to backend endpoints.
  - [style.css](file:///v:/capstone%20prj/public/style.css) — Custom responsive styling framework.
- [scripts/](file:///v:/capstone%20prj/scripts/) — Command-line database tools.
  - [seed-admin.js](file:///v:/capstone%20prj/scripts/seed-admin.js) — CLI utility to initialize the system admin user.

---

## 💾 Database Schema

The platform relies on four core tables in Supabase Postgres:

### 1. `users`
Tracks system identities and permissions.
- `id` (bigint/serial, Primary Key)
- `name` (text)
- `email` (text, Unique)
- `password_hash` (text)
- `role` (text: `'customer'`, `'agent'`, or `'admin'`)
- `created_at` (timestamp)

### 2. `tickets`
Tracks individual tickets and their current workflow state.
- `id` (bigint/serial, Primary Key)
- `title` (text)
- `category` (text)
- `priority` (text: `'low'`, `'medium'`, or `'high'`)
- `description` (text)
- `status` (text: `'open'`, `'assigned'`, `'in_progress'`, `'resolved'`, or `'closed'`)
- `customer_id` (foreign key -> `users.id`)
- `assigned_agent_id` (foreign key -> `users.id`, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `resolved_at` (timestamp, nullable)

### 3. `responses`
Maintains the communication threads for each ticket.
- `id` (bigint/serial, Primary Key)
- `ticket_id` (foreign key -> `tickets.id`)
- `sender_id` (foreign key -> `users.id`)
- `message` (text)
- `created_at` (timestamp)

### 4. `password_reset_tokens`
Manages secure OTP (One-Time Password) reset sessions.
- `id` (bigint/serial, Primary Key)
- `user_id` (foreign key -> `users.id`)
- `otp_hash` (text)
- `expires_at` (timestamp)
- `attempts` (integer)
- `verified` (boolean)
- `used` (boolean)
- `reset_token_hash` (text, nullable)
- `reset_expires_at` (timestamp, nullable)

---

## 🚀 Getting Started

Follow these steps to spin up the project locally:

### 1. Clone & Install Dependencies
```bash
git clone <your-repo-url>
cd resolvedesk
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
PORT=3000
JWT_SECRET=your_jwt_secret_key_here
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SECRET_KEY=your-supabase-service-role-or-secret-key
```

### 3. Seed the System Admin
Before logging in as an administrator, seed the initial database user:
```bash
node scripts/seed-admin.js
```
*Note: This creates a default admin user `admin@helpdesk.com` with the password `Admin123!` (or the password configured in `ADMIN_PASSWORD` in your `.env` file).*

### 4. Start the Application
```bash
npm start
```
Open your browser and navigate to `http://localhost:3000` to start using ResolveDesk!
