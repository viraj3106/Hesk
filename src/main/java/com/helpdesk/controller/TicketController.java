package com.helpdesk.controller;

import com.helpdesk.entity.Ticket;
import com.helpdesk.entity.TicketResponse;
import com.helpdesk.entity.TicketStatusHistory;
import com.helpdesk.entity.User;
import com.helpdesk.repository.TicketRepository;
import com.helpdesk.repository.TicketResponseRepository;
import com.helpdesk.repository.TicketStatusHistoryRepository;
import com.helpdesk.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/tickets")
@SuppressWarnings("unchecked")
public class TicketController {

    @Autowired
    private TicketRepository ticketRepository;

    @Autowired
    private TicketResponseRepository ticketResponseRepository;

    @Autowired
    private TicketStatusHistoryRepository ticketStatusHistoryRepository;

    @Autowired
    private UserRepository userRepository;

    private static final Map<String, List<String>> LEGAL_TRANSITIONS = new HashMap<>();
    static {
        LEGAL_TRANSITIONS.put("open", Arrays.asList("assigned"));
        LEGAL_TRANSITIONS.put("assigned", Arrays.asList("in_progress"));
        LEGAL_TRANSITIONS.put("in_progress", Arrays.asList("resolved"));
        LEGAL_TRANSITIONS.put("resolved", Arrays.asList("closed", "in_progress"));
        LEGAL_TRANSITIONS.put("closed", Arrays.asList("in_progress"));
    }

    private Ticket getTicketOr404(Long id, ResponseEntity<?>[] errorHolder) {
        Optional<Ticket> opt = ticketRepository.findById(id);
        if (!opt.isPresent()) {
            errorHolder[0] = ResponseEntity.status(HttpStatus.NOT_FOUND).body(Collections.singletonMap("error", "Ticket not found"));
            return null;
        }
        return opt.get();
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createTicket(
            @RequestAttribute("user") Map<String, Object> user,
            @RequestBody Map<String, String> body) {
        
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

        Ticket ticket = new Ticket();
        ticket.setTitle(title);
        ticket.setCategory(category);
        ticket.setPriority(priority);
        ticket.setDescription(description);
        ticket.setCustomerId(customerId);
        ticket.setStatus("open");

        ticket = ticketRepository.save(ticket);
        recordStatusHistory(ticket.getId(), null, "open", customerId);

        Map<String, Object> responseMap = new HashMap<>();
        responseMap.put("id", ticket.getId());
        responseMap.put("customer_id", ticket.getCustomerId());
        responseMap.put("assigned_agent_id", ticket.getAssignedAgentId());
        responseMap.put("title", ticket.getTitle());
        responseMap.put("description", ticket.getDescription());
        responseMap.put("category", ticket.getCategory());
        responseMap.put("priority", ticket.getPriority());
        responseMap.put("status", ticket.getStatus());
        responseMap.put("created_at", ticket.getCreatedAt());
        responseMap.put("updated_at", ticket.getUpdatedAt());

        return ResponseEntity.status(HttpStatus.CREATED).body(responseMap);
    }

    @GetMapping("/my")
    public ResponseEntity<List<Ticket>> getMyTickets(@RequestAttribute("user") Map<String, Object> user) {
        String role = (String) user.get("role");
        if (!"customer".equals(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Long customerId = ((Number) user.get("id")).longValue();
        List<Ticket> tickets = ticketRepository.findByCustomerIdOrderByCreatedAtDesc(customerId);
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
        int pageIndex = Math.max(0, page - 1);
        PageRequest pageRequest = PageRequest.of(pageIndex, limit, Sort.by(Sort.Direction.DESC, "updatedAt"));

        Page<Ticket> pageResult;
        if (status != null && !status.trim().isEmpty()) {
            pageResult = ticketRepository.findByAssignedAgentIdAndStatusOrderByUpdatedAtDesc(agentId, status.trim(), pageRequest);
        } else {
            pageResult = ticketRepository.findByAssignedAgentIdOrderByUpdatedAtDesc(agentId, pageRequest);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("data", pageResult.getContent());
        response.put("page", page);
        response.put("limit", limit);
        response.put("total", pageResult.getTotalElements());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getTicket(
            @RequestAttribute("user") Map<String, Object> user,
            @PathVariable("id") Long id) {
        
        ResponseEntity<?>[] errorHolder = new ResponseEntity<?>[1];
        Ticket ticket = getTicketOr404(id, errorHolder);
        if (ticket == null) return errorHolder[0];

        String role = (String) user.get("role");
        Long userId = ((Number) user.get("id")).longValue();

        if ("customer".equals(role) && !userId.equals(ticket.getCustomerId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: not your ticket"));
        }
        if ("agent".equals(role) && !userId.equals(ticket.getAssignedAgentId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: not assigned to you"));
        }

        // Retrieve responses
        List<TicketResponse> responses = ticketResponseRepository.findByTicketIdOrderByCreatedAtAsc(id);
        List<Map<String, Object>> flatResponses = new ArrayList<>();

        for (TicketResponse r : responses) {
            Map<String, Object> flat = new HashMap<>();
            flat.put("id", r.getId());
            flat.put("ticket_id", r.getTicketId());
            flat.put("sender_id", r.getSenderId());
            flat.put("message", r.getMessage());
            flat.put("created_at", r.getCreatedAt());

            Optional<User> senderUserOpt = userRepository.findById(r.getSenderId());
            if (senderUserOpt.isPresent()) {
                flat.put("email", senderUserOpt.get().getEmail());
                flat.put("role", senderUserOpt.get().getRole());
            } else {
                flat.put("email", "");
                flat.put("role", "");
            }
            flatResponses.add(flat);
        }

        Map<String, Object> responseBody = new HashMap<>();
        responseBody.put("id", ticket.getId());
        responseBody.put("customer_id", ticket.getCustomerId());
        responseBody.put("assigned_agent_id", ticket.getAssignedAgentId());
        responseBody.put("title", ticket.getTitle());
        responseBody.put("description", ticket.getDescription());
        responseBody.put("category", ticket.getCategory());
        responseBody.put("priority", ticket.getPriority());
        responseBody.put("status", ticket.getStatus());
        responseBody.put("created_at", ticket.getCreatedAt());
        responseBody.put("updated_at", ticket.getUpdatedAt());
        responseBody.put("resolved_at", ticket.getResolvedAt());
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
        Ticket ticket = getTicketOr404(id, errorHolder);
        if (ticket == null) return (ResponseEntity<Map<String, Object>>) errorHolder[0];

        String role = (String) user.get("role");
        Long userId = ((Number) user.get("id")).longValue();

        if ("customer".equals(role) && !userId.equals(ticket.getCustomerId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: not your ticket"));
        }
        if ("agent".equals(role) && !userId.equals(ticket.getAssignedAgentId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: not assigned to you"));
        }

        TicketResponse responseEntity = new TicketResponse(id, userId, message.trim());
        ticketResponseRepository.save(responseEntity);

        ticket.setUpdatedAt(new Date());
        ticketRepository.save(ticket);

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
        Ticket ticket = getTicketOr404(id, errorHolder);
        if (ticket == null) return (ResponseEntity<Map<String, Object>>) errorHolder[0];

        String role = (String) user.get("role");
        if (!"agent".equals(role) && !"admin".equals(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: insufficient permissions"));
        }

        Long userId = ((Number) user.get("id")).longValue();

        if ("agent".equals(role) && !userId.equals(ticket.getAssignedAgentId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: not assigned to you"));
        }

        String currentStatus = ticket.getStatus();
        List<String> allowed = LEGAL_TRANSITIONS.get(currentStatus);
        if (allowed == null || !allowed.contains(status)) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Invalid transition from " + currentStatus + " to " + status));
        }

        if (!"assigned".equals(status) && ticket.getAssignedAgentId() == null) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Cannot transition status past assigned without an assigned agent"));
        }

        ticket.setStatus(status);
        ticket.setUpdatedAt(new Date());
        if ("resolved".equals(status)) {
            ticket.setResolvedAt(new Date());
        } else {
            ticket.setResolvedAt(null);
        }

        ticketRepository.save(ticket);
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
        Ticket ticket = getTicketOr404(id, errorHolder);
        if (ticket == null) return (ResponseEntity<Map<String, Object>>) errorHolder[0];

        Optional<User> agentOpt = userRepository.findById(agentId);
        if (!agentOpt.isPresent() || !"agent".equals(agentOpt.get().getRole())) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Invalid agent ID"));
        }

        String currentStatus = ticket.getStatus();
        ticket.setAssignedAgentId(agentId);
        ticket.setStatus("assigned");
        ticket.setResolvedAt(null);
        ticket.setUpdatedAt(new Date());

        ticketRepository.save(ticket);
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
        Ticket ticket = getTicketOr404(id, errorHolder);
        if (ticket == null) return (ResponseEntity<Map<String, Object>>) errorHolder[0];

        Long userId = ((Number) user.get("id")).longValue();
        if (!userId.equals(ticket.getCustomerId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: not your ticket"));
        }

        String currentStatus = ticket.getStatus();
        if (!Arrays.asList("resolved", "closed").contains(currentStatus)) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Only resolved or closed tickets can be reopened"));
        }

        ticket.setStatus("in_progress");
        ticket.setResolvedAt(null);
        ticket.setUpdatedAt(new Date());
        ticketRepository.save(ticket);

        TicketResponse threadComment = new TicketResponse(id, userId, "Reopened: " + reason.trim());
        ticketResponseRepository.save(threadComment);

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
        Ticket ticket = getTicketOr404(id, errorHolder);
        if (ticket == null) return (ResponseEntity<Map<String, Object>>) errorHolder[0];

        Long userId = ((Number) user.get("id")).longValue();
        if (!userId.equals(ticket.getCustomerId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("error", "Access forbidden: not your ticket"));
        }

        String currentStatus = ticket.getStatus();
        if (!"resolved".equals(currentStatus)) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Only resolved tickets can be closed"));
        }

        ticket.setStatus("closed");
        ticket.setUpdatedAt(new Date());
        ticketRepository.save(ticket);

        recordStatusHistory(id, currentStatus, "closed", userId);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Ticket closed successfully");
        response.put("status", "closed");

        return ResponseEntity.ok(response);
    }

    private void recordStatusHistory(Long ticketId, String oldStatus, String newStatus, Long userId) {
        try {
            TicketStatusHistory history = new TicketStatusHistory(ticketId, oldStatus, newStatus, userId);
            ticketStatusHistoryRepository.save(history);
        } catch (Exception e) {
            System.err.println("Warning: failed to record status history: " + e.getMessage());
        }
    }
}
