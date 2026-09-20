package com.helpdesk.controller;

import com.helpdesk.entity.Ticket;
import com.helpdesk.entity.User;
import com.helpdesk.repository.TicketRepository;
import com.helpdesk.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.persistence.criteria.Predicate;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/admin")
@SuppressWarnings("unchecked")
public class AdminController {

    @Autowired
    private TicketRepository ticketRepository;

    @Autowired
    private UserRepository userRepository;

    private boolean isAdmin(Map<String, Object> user) {
        return user != null && "admin".equals(user.get("role"));
    }

    @GetMapping("/tickets")
    public ResponseEntity<Map<String, Object>> getTickets(
            @RequestAttribute("user") Map<String, Object> user,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "priority", required = false) String priority,
            @RequestParam(value = "assigned_agent_id", required = false) String agentIdStr,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "limit", defaultValue = "20") int limit) {

        if (!isAdmin(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Specification<Ticket> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null && !status.trim().isEmpty()) {
                predicates.add(cb.equal(root.get("status"), status.trim()));
            }
            if (priority != null && !priority.trim().isEmpty()) {
                predicates.add(cb.equal(root.get("priority"), priority.trim()));
            }
            if (agentIdStr != null && !agentIdStr.trim().isEmpty()) {
                if ("unassigned".equalsIgnoreCase(agentIdStr.trim())) {
                    predicates.add(cb.isNull(root.get("assignedAgentId")));
                } else {
                    try {
                        Long agentId = Long.parseLong(agentIdStr.trim());
                        predicates.add(cb.equal(root.get("assignedAgentId"), agentId));
                    } catch (NumberFormatException ignored) {}
                }
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        int pageIndex = Math.max(0, page - 1);
        PageRequest pageRequest = PageRequest.of(pageIndex, limit, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Ticket> pageResult = ticketRepository.findAll(spec, pageRequest);

        // Preload users cache to avoid N+1 queries
        Map<Long, User> userCache = new HashMap<>();
        for (User u : userRepository.findAll()) {
            userCache.put(u.getId(), u);
        }

        List<Map<String, Object>> formattedTickets = new ArrayList<>();
        for (Ticket t : pageResult.getContent()) {
            Map<String, Object> formatted = new HashMap<>();
            formatted.put("id", t.getId());
            formatted.put("title", t.getTitle());
            formatted.put("category", t.getCategory());
            formatted.put("priority", t.getPriority());
            formatted.put("status", t.getStatus());
            formatted.put("customer_id", t.getCustomerId());

            User customer = userCache.get(t.getCustomerId());
            formatted.put("customer_name", customer != null ? customer.getName() : null);
            formatted.put("customer_email", customer != null ? customer.getEmail() : null);

            formatted.put("assigned_agent_id", t.getAssignedAgentId());
            User agent = t.getAssignedAgentId() != null ? userCache.get(t.getAssignedAgentId()) : null;
            formatted.put("agent_name", agent != null ? agent.getName() : null);
            formatted.put("agent_email", agent != null ? agent.getEmail() : null);

            formatted.put("created_at", t.getCreatedAt());
            formatted.put("updated_at", t.getUpdatedAt());

            formattedTickets.add(formatted);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("data", formattedTickets);
        response.put("page", page);
        response.put("limit", limit);
        response.put("total", pageResult.getTotalElements());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/agents")
    public ResponseEntity<List<Map<String, Object>>> getAgents(@RequestAttribute("user") Map<String, Object> user) {
        if (!isAdmin(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        List<User> agents = userRepository.findByRole("agent");
        List<Ticket> allTickets = ticketRepository.findAll();

        Map<Long, Integer> countsMap = new HashMap<>();
        for (Ticket t : allTickets) {
            String status = t.getStatus();
            if (Arrays.asList("assigned", "in_progress").contains(status)) {
                Long agentId = t.getAssignedAgentId();
                if (agentId != null) {
                    countsMap.put(agentId, countsMap.getOrDefault(agentId, 0) + 1);
                }
            }
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (User agent : agents) {
            Map<String, Object> r = new HashMap<>();
            r.put("id", agent.getId());
            r.put("name", agent.getName());
            r.put("email", agent.getEmail());
            r.put("active_ticket_count", countsMap.getOrDefault(agent.getId(), 0));
            result.add(r);
        }

        result.sort((a, b) -> ((Integer) b.get("active_ticket_count")).compareTo((Integer) a.get("active_ticket_count")));
        return ResponseEntity.ok(result);
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats(@RequestAttribute("user") Map<String, Object> user) {
        if (!isAdmin(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        List<Ticket> tickets = ticketRepository.findAll();

        long total = tickets.size();
        long open = 0, assigned = 0, inProgress = 0, resolved = 0, closed = 0;
        long totalResolvedClosed = 0;
        double totalDays = 0.0;

        for (Ticket t : tickets) {
            String status = t.getStatus();
            if ("open".equals(status)) open++;
            else if ("assigned".equals(status)) assigned++;
            else if ("in_progress".equals(status)) inProgress++;
            else if ("resolved".equals(status)) resolved++;
            else if ("closed".equals(status)) closed++;

            if (Arrays.asList("resolved", "closed").contains(status)) {
                totalResolvedClosed++;
                Date created = t.getCreatedAt();
                Date updated = t.getUpdatedAt();
                if (created != null && updated != null) {
                    long diffMs = updated.getTime() - created.getTime();
                    double diffDays = diffMs / (1000.0 * 60.0 * 60.0 * 24.0);
                    totalDays += Math.max(0.0, diffDays);
                }
            }
        }

        double avgResolutionDays = 0.0;
        if (totalResolvedClosed > 0) {
            avgResolutionDays = Math.round((totalDays / totalResolvedClosed) * 100.0) / 100.0;
        }

        Map<String, Object> stats = new HashMap<>();
        stats.put("total", total);
        stats.put("open", open);
        stats.put("assigned", assigned);
        stats.put("in_progress", inProgress);
        stats.put("resolved", resolved);
        stats.put("closed", closed);
        stats.put("avg_resolution_days", avgResolutionDays);

        return ResponseEntity.ok(stats);
    }

    @GetMapping("/analytics")
    public ResponseEntity<Map<String, Object>> getAnalytics(@RequestAttribute("user") Map<String, Object> user) {
        if (!isAdmin(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        List<Ticket> tickets = ticketRepository.findAll();

        long totalTickets = tickets.size();
        long openTickets = 0, assignedTickets = 0, inProgressTickets = 0, resolvedTickets = 0, closedTickets = 0;
        long lowPriority = 0, mediumPriority = 0, highPriority = 0;

        long resolvedTicketsListCount = 0;
        long totalMs = 0;

        for (Ticket t : tickets) {
            String status = t.getStatus();
            if ("open".equals(status)) openTickets++;
            else if ("assigned".equals(status)) assignedTickets++;
            else if ("in_progress".equals(status)) inProgressTickets++;
            else if ("resolved".equals(status)) resolvedTickets++;
            else if ("closed".equals(status)) closedTickets++;

            String priority = t.getPriority();
            if ("low".equals(priority)) lowPriority++;
            else if ("medium".equals(priority)) mediumPriority++;
            else if ("high".equals(priority)) highPriority++;

            Date created = t.getCreatedAt();
            Date resolvedTime = t.getResolvedAt() != null ? t.getResolvedAt() : (("resolved".equals(status) || "closed".equals(status)) ? t.getUpdatedAt() : null);
            if (created != null && resolvedTime != null) {
                resolvedTicketsListCount++;
                totalMs += Math.max(0, resolvedTime.getTime() - created.getTime());
            }
        }

        long averageResolutionTime = 0;
        if (resolvedTicketsListCount > 0) {
            averageResolutionTime = Math.round((double) totalMs / (1000.0 * 60.0 * resolvedTicketsListCount));
        }

        // Fetch agents
        List<User> agents = userRepository.findByRole("agent");
        List<Map<String, Object>> agentWorkload = new ArrayList<>();
        for (User agent : agents) {
            long activeTickets = 0;
            for (Ticket t : tickets) {
                if (agent.getId().equals(t.getAssignedAgentId())) {
                    String status = t.getStatus();
                    if (Arrays.asList("assigned", "in_progress").contains(status)) {
                        activeTickets++;
                    }
                }
            }
            Map<String, Object> w = new HashMap<>();
            w.put("id", agent.getId());
            w.put("name", agent.getName() != null ? agent.getName() : agent.getEmail());
            w.put("activeTickets", activeTickets);
            agentWorkload.add(w);
        }
        agentWorkload.sort((a, b) -> ((Long) b.get("activeTickets")).compareTo((Long) a.get("activeTickets")));

        // Preload users cache
        Map<Long, User> userCache = new HashMap<>();
        for (User u : userRepository.findAll()) {
            userCache.put(u.getId(), u);
        }

        // Fetch recent 10 tickets
        List<Ticket> recent = ticketRepository.findTop10ByOrderByCreatedAtDesc();
        List<Map<String, Object>> recentTickets = new ArrayList<>();
        for (Ticket t : recent) {
            Map<String, Object> formatted = new HashMap<>();
            formatted.put("id", t.getId());
            formatted.put("title", t.getTitle());
            formatted.put("category", t.getCategory());
            formatted.put("priority", t.getPriority());
            formatted.put("status", t.getStatus());

            User customer = userCache.get(t.getCustomerId());
            formatted.put("customer_name", customer != null ? customer.getName() : null);
            formatted.put("customer_email", customer != null ? customer.getEmail() : null);

            User agent = t.getAssignedAgentId() != null ? userCache.get(t.getAssignedAgentId()) : null;
            formatted.put("assigned_agent_name", agent != null ? agent.getName() : null);
            formatted.put("assigned_agent_email", agent != null ? agent.getEmail() : null);

            formatted.put("created_at", t.getCreatedAt());
            recentTickets.add(formatted);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("totalTickets", totalTickets);
        response.put("openTickets", openTickets);
        response.put("assignedTickets", assignedTickets);
        response.put("inProgressTickets", inProgressTickets);
        response.put("resolvedTickets", resolvedTickets);
        response.put("closedTickets", closedTickets);
        response.put("lowPriority", lowPriority);
        response.put("mediumPriority", mediumPriority);
        response.put("highPriority", highPriority);
        response.put("agentWorkload", agentWorkload);
        response.put("averageResolutionTime", averageResolutionTime);
        response.put("recentTickets", recentTickets);

        return ResponseEntity.ok(response);
    }
}
