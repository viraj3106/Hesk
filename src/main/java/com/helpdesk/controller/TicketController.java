package com.helpdesk.controller;

import com.helpdesk.service.SupabaseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/tickets")
@SuppressWarnings("unchecked")
public class TicketController {

    @Autowired
    private SupabaseService supabaseService;

    private static final Map<String, List<String>> LEGAL_TRANSITIONS = new HashMap<>();
    static {
        LEGAL_TRANSITIONS.put("open", Arrays.asList("assigned"));
        LEGAL_TRANSITIONS.put("assigned", Arrays.asList("in_progress"));
        LEGAL_TRANSITIONS.put("in_progress", Arrays.asList("resolved"));
        LEGAL_TRANSITIONS.put("resolved", Arrays.asList("closed", "in_progress"));
        LEGAL_TRANSITIONS.put("closed", Arrays.asList("in_progress"));
    }

    private Map<String, Object> getTicketOr404(Long id, ResponseEntity<?>[] errorHolder) {
        Map<String, String> filter = Collections.singletonMap("id", "eq." + id);
        Map<String, Object> ticket = supabaseService.selectSingle("tickets", filter);
        if (ticket == null) {
            errorHolder[0] = ResponseEntity.status(HttpStatus.NOT_FOUND).body(Collections.singletonMap("error", "Ticket not found"));
        }
        return ticket;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createTicket(@RequestAttribute("user") Map<String, Object> user, @RequestBody Map<String, String> body) {
        String role = (String) user.get("role");
        if (!"customer".equals(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: insufficient permissions"));
        }

        String title = body.get("title");
        String category = body.get("category");
        String priority = body.get("priority");
        String description = body.get("description");

        if (title == null || category == null || priority == null || description == null) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Title, category, priority, and description are required"));
        }
        if (!Arrays.asList("low", "medium", "high").contains(priority)) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Invalid priority"));
        }

        Long customerId = ((Number) user.get("id")).longValue();

        Map<String, Object> insertData = new HashMap<>();
        insertData.put("title", title);
        insertData.put("category", category);
        insertData.put("priority", priority);
        insertData.put("description", description);
        insertData.put("customer_id", customerId);
        insertData.put("status", "open");

        Map<String, Object> ticket = supabaseService.insert("tickets", insertData);
        if (ticket == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Collections.singletonMap("error", "Failed to create ticket"));
        }
        
        try {
            Long ticketId = ((Number) ticket.get("id")).longValue();
            recordStatusHistory(ticketId, null, "open", customerId);
        } catch (Exception ignored) {}
        
        return ResponseEntity.status(HttpStatus.CREATED).body(ticket);
    }

    @GetMapping("/my")
    public ResponseEntity<List<Map<String, Object>>> getMyTickets(@RequestAttribute("user") Map<String, Object> user) {
        String role = (String) user.get("role");
        if (!"customer".equals(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Long customerId = ((Number) user.get("id")).longValue();
        Map<String, String> filters = Collections.singletonMap("customer_id", "eq." + customerId);
        List<Map<String, Object>> tickets = supabaseService.select("tickets", "*", filters, "created_at.desc", null, null);
        return ResponseEntity.ok(tickets != null ? tickets : Collections.emptyList());
    }

    @GetMapping("/queue")
    public ResponseEntity<Map<String, Object>> getQueue(
            @RequestAttribute("user") Map<String, Object> user,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "limit", defaultValue = "20") int limit) {
        
        String role = (String) user.get("role");
        if (!"agent".equals(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Long agentId = ((Number) user.get("id")).longValue();
        Map<String, String> filters = new HashMap<>();
        filters.put("assigned_agent_id", "eq." + agentId);
        if (status != null && !status.isEmpty()) {
            filters.put("status", "eq." + status);
        }

        int offset = (page - 1) * limit;
        SupabaseService.PaginatedResult result = supabaseService.selectPaginated("tickets", "*", filters, "updated_at.desc", limit, offset);

        Map<String, Object> response = new HashMap<>();
        response.put("data", result.data != null ? result.data : Collections.emptyList());
        response.put("page", page);
        response.put("limit", limit);
        response.put("total", result.total);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getTicket(@RequestAttribute("user") Map<String, Object> user, @PathVariable("id") Long id) {
        ResponseEntity<?>[] errorHolder = new ResponseEntity<?>[1];
        Map<String, Object> ticket = getTicketOr404(id, errorHolder);
        if (ticket == null) return errorHolder[0];

        String role = (String) user.get("role");
        Long userId = ((Number) user.get("id")).longValue();

        Long ticketCustomerId = ((Number) ticket.get("customer_id")).longValue();
        Object assignedAgentObj = ticket.get("assigned_agent_id");
        Long ticketAgentId = assignedAgentObj != null ? ((Number) assignedAgentObj).longValue() : null;

        if ("customer".equals(role) && !userId.equals(ticketCustomerId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: not your ticket"));
        }
        if ("agent".equals(role) && !userId.equals(ticketAgentId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: not assigned to you"));
        }

        // Retrieve responses
        Map<String, String> filter = Collections.singletonMap("ticket_id", "eq." + id);
        List<Map<String, Object>> responses = supabaseService.select("responses", "*,users:sender_id(email,role)", filter, "created_at.asc", null, null);

        List<Map<String, Object>> flatResponses = new ArrayList<>();
        if (responses != null) {
            for (Map<String, Object> r : responses) {
                Map<String, Object> flat = new HashMap<>();
                flat.put("id", r.get("id"));
                flat.put("ticket_id", r.get("ticket_id"));
                flat.put("sender_id", r.get("sender_id"));
                flat.put("message", r.get("message"));
                flat.put("created_at", r.get("created_at"));
                
                Map<String, Object> senderUser = (Map<String, Object>) r.get("users");
                if (senderUser != null) {
                    flat.put("email", senderUser.get("email"));
                    flat.put("role", senderUser.get("role"));
                } else {
                    flat.put("email", "");
                    flat.put("role", "");
                }
                flatResponses.add(flat);
            }
        }

        Map<String, Object> responseBody = new HashMap<>(ticket);
        responseBody.put("responses", flatResponses);
        return ResponseEntity.ok(responseBody);
    }

    @PostMapping("/{id}/respond")
    public ResponseEntity<Map<String, Object>> postResponse(
            @RequestAttribute("user") Map<String, Object> user,
            @PathVariable("id") Long id,
            @RequestBody Map<String, String> body) {
        
        String message = body.get("message");
        if (message == null || message.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Message is required"));
        }

        ResponseEntity<?>[] errorHolder = new ResponseEntity<?>[1];
        Map<String, Object> ticket = getTicketOr404(id, errorHolder);
        if (ticket == null) return (ResponseEntity<Map<String, Object>>) errorHolder[0];

        String role = (String) user.get("role");
        Long userId = ((Number) user.get("id")).longValue();

        Long ticketCustomerId = ((Number) ticket.get("customer_id")).longValue();
        Object assignedAgentObj = ticket.get("assigned_agent_id");
        Long ticketAgentId = assignedAgentObj != null ? ((Number) assignedAgentObj).longValue() : null;

        if ("customer".equals(role) && !userId.equals(ticketCustomerId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: not your ticket"));
        }
        if ("agent".equals(role) && !userId.equals(ticketAgentId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: not assigned to you"));
        }

        // Insert response
        Map<String, Object> responseData = new HashMap<>();
        responseData.put("ticket_id", id);
        responseData.put("sender_id", userId);
        responseData.put("message", message.trim());
        supabaseService.insert("responses", responseData);

        // Update ticket updated_at
        Map<String, Object> updateTicket = new HashMap<>();
        updateTicket.put("updated_at", Instant.now().toString());
        Map<String, String> ticketFilter = Collections.singletonMap("id", "eq." + id);
        supabaseService.update("tickets", updateTicket, ticketFilter);

        return ResponseEntity.status(HttpStatus.CREATED).body(Collections.singletonMap("message", "Response added successfully"));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<Map<String, Object>> updateStatus(
            @RequestAttribute("user") Map<String, Object> user,
            @PathVariable("id") Long id,
            @RequestBody Map<String, String> body) {
        
        String status = body.get("status");
        if (status == null) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Status is required"));
        }

        ResponseEntity<?>[] errorHolder = new ResponseEntity<?>[1];
        Map<String, Object> ticket = getTicketOr404(id, errorHolder);
        if (ticket == null) return (ResponseEntity<Map<String, Object>>) errorHolder[0];

        String role = (String) user.get("role");
        if (!"agent".equals(role) && !"admin".equals(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: insufficient permissions"));
        }

        Long userId = ((Number) user.get("id")).longValue();

        Object assignedAgentObj = ticket.get("assigned_agent_id");
        Long ticketAgentId = assignedAgentObj != null ? ((Number) assignedAgentObj).longValue() : null;

        if ("agent".equals(role) && !userId.equals(ticketAgentId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: not assigned to you"));
        }

        String currentStatus = (String) ticket.get("status");
        List<String> allowed = LEGAL_TRANSITIONS.get(currentStatus);
        if (allowed == null || !allowed.contains(status)) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Invalid transition from " + currentStatus + " to " + status));
        }

        // assigned_agent_id must be set before status can move past 'assigned'
        if (!"assigned".equals(status) && ticketAgentId == null) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Cannot transition status past assigned without an assigned agent"));
        }

        Map<String, Object> updatePayload = new HashMap<>();
        updatePayload.put("status", status);
        updatePayload.put("updated_at", Instant.now().toString());
        if ("resolved".equals(status)) {
            updatePayload.put("resolved_at", Instant.now().toString());
        } else {
            updatePayload.put("resolved_at", null);
        }

        Map<String, String> ticketFilter = Collections.singletonMap("id", "eq." + id);
        supabaseService.update("tickets", updatePayload, ticketFilter);

        recordStatusHistory(id, currentStatus, status, userId);

        return ResponseEntity.ok(Collections.singletonMap("message", "Status updated to " + status));
    }

    @PatchMapping("/{id}/assign")
    public ResponseEntity<Map<String, Object>> assignTicket(
            @RequestAttribute("user") Map<String, Object> user,
            @PathVariable("id") Long id,
            @RequestBody Map<String, Object> body) {
        
        String role = (String) user.get("role");
        if (!"admin".equals(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: insufficient permissions"));
        }

        Object agentIdObj = body.get("agent_id");
        if (agentIdObj == null) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Agent ID is required"));
        }
        Long agentId;
        if (agentIdObj instanceof Number) {
            agentId = ((Number) agentIdObj).longValue();
        } else {
            try {
                agentId = Long.parseLong(agentIdObj.toString());
            } catch (NumberFormatException e) {
                return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Invalid Agent ID format"));
            }
        }

        ResponseEntity<?>[] errorHolder = new ResponseEntity<?>[1];
        Map<String, Object> ticket = getTicketOr404(id, errorHolder);
        if (ticket == null) return (ResponseEntity<Map<String, Object>>) errorHolder[0];

        // Verify agent_id is indeed an agent
        Map<String, String> agentFilter = Collections.singletonMap("id", "eq." + agentId);
        Map<String, Object> agent = supabaseService.selectSingle("users", agentFilter);
        if (agent == null || !"agent".equals(agent.get("role"))) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Invalid agent ID"));
        }

        String currentStatus = (String) ticket.get("status");

        Map<String, Object> updatePayload = new HashMap<>();
        updatePayload.put("assigned_agent_id", agentId);
        updatePayload.put("status", "assigned");
        updatePayload.put("resolved_at", null);
        updatePayload.put("updated_at", Instant.now().toString());

        Map<String, String> ticketFilter = Collections.singletonMap("id", "eq." + id);
        supabaseService.update("tickets", updatePayload, ticketFilter);

        recordStatusHistory(id, currentStatus, "assigned", ((Number) user.get("id")).longValue());

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Ticket assigned successfully");
        response.put("assigned_agent_id", agentId);
        response.put("status", "assigned");

        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/reopen")
    public ResponseEntity<Map<String, Object>> reopenTicket(
            @RequestAttribute("user") Map<String, Object> user,
            @PathVariable("id") Long id,
            @RequestBody Map<String, String> body) {
        
        String role = (String) user.get("role");
        if (!"customer".equals(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: insufficient permissions"));
        }

        String reason = body != null ? body.get("reason") : null;
        if (reason == null || reason.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Reopen reason is required"));
        }

        ResponseEntity<?>[] errorHolder = new ResponseEntity<?>[1];
        Map<String, Object> ticket = getTicketOr404(id, errorHolder);
        if (ticket == null) return (ResponseEntity<Map<String, Object>>) errorHolder[0];

        Long userId = ((Number) user.get("id")).longValue();
        Long ticketCustomerId = ((Number) ticket.get("customer_id")).longValue();

        if (!userId.equals(ticketCustomerId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: not your ticket"));
        }

        String currentStatus = (String) ticket.get("status");
        if (!Arrays.asList("resolved", "closed").contains(currentStatus)) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Only resolved or closed tickets can be reopened"));
        }

        Map<String, Object> updatePayload = new HashMap<>();
        updatePayload.put("status", "in_progress");
        updatePayload.put("resolved_at", null);
        updatePayload.put("updated_at", Instant.now().toString());

        Map<String, String> ticketFilter = Collections.singletonMap("id", "eq." + id);
        supabaseService.update("tickets", updatePayload, ticketFilter);

        // Insert thread comment
        Map<String, Object> responseData = new HashMap<>();
        responseData.put("ticket_id", id);
        responseData.put("sender_id", userId);
        responseData.put("message", "Reopened: " + reason.trim());
        supabaseService.insert("responses", responseData);

        recordStatusHistory(id, currentStatus, "in_progress", userId);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Ticket reopened successfully");
        response.put("status", "in_progress");

        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/close")
    public ResponseEntity<Map<String, Object>> closeTicket(
            @RequestAttribute("user") Map<String, Object> user,
            @PathVariable("id") Long id) {
        
        String role = (String) user.get("role");
        if (!"customer".equals(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: insufficient permissions"));
        }

        ResponseEntity<?>[] errorHolder = new ResponseEntity<?>[1];
        Map<String, Object> ticket = getTicketOr404(id, errorHolder);
        if (ticket == null) return (ResponseEntity<Map<String, Object>>) errorHolder[0];

        Long userId = ((Number) user.get("id")).longValue();
        Long ticketCustomerId = ((Number) ticket.get("customer_id")).longValue();

        if (!userId.equals(ticketCustomerId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: not your ticket"));
        }

        String currentStatus = (String) ticket.get("status");
        if (!"resolved".equals(currentStatus)) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Only resolved tickets can be closed"));
        }

        Map<String, Object> updatePayload = new HashMap<>();
        updatePayload.put("status", "closed");
        updatePayload.put("updated_at", Instant.now().toString());

        Map<String, String> ticketFilter = Collections.singletonMap("id", "eq." + id);
        supabaseService.update("tickets", updatePayload, ticketFilter);

        recordStatusHistory(id, currentStatus, "closed", userId);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Ticket closed successfully");
        response.put("status", "closed");

        return ResponseEntity.ok(response);
    }

    private void recordStatusHistory(Long ticketId, String oldStatus, String newStatus, Long userId) {
        try {
            Map<String, Object> historyData = new HashMap<>();
            historyData.put("ticket_id", ticketId);
            historyData.put("old_status", oldStatus);
            historyData.put("new_status", newStatus);
            historyData.put("changed_by", userId);
            supabaseService.insert("ticket_status_history", historyData);
        } catch (Exception e) {
            System.err.println("Warning: failed to record status history: " + e.getMessage());
        }
    }
}
