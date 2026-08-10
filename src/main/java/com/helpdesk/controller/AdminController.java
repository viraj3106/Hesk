package com.helpdesk.controller;

import com.helpdesk.service.SupabaseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/admin")
@SuppressWarnings("unchecked")
public class AdminController {

    @Autowired
    private SupabaseService supabaseService;

    private boolean isAdmin(Map<String, Object> user) {
        return "admin".equals(user.get("role"));
    }

    @GetMapping("/tickets")
    public ResponseEntity<Map<String, Object>> getTickets(
            @RequestAttribute("user") Map<String, Object> user,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "priority", required = false) String priority,
            @RequestParam(value = "assigned_agent_id", required = false) String agentId,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "limit", defaultValue = "20") int limit) {

        if (!isAdmin(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Map<String, String> filters = new HashMap<>();
        if (status != null && !status.isEmpty()) {
            filters.put("status", "eq." + status);
        }
        if (priority != null && !priority.isEmpty()) {
            filters.put("priority", "eq." + priority);
        }
        if (agentId != null && !agentId.isEmpty()) {
            if ("unassigned".equals(agentId)) {
                filters.put("assigned_agent_id", "is.null");
            } else {
                filters.put("assigned_agent_id", "eq." + agentId);
            }
        }

        int offset = (page - 1) * limit;
        String select = "*,customer:customer_id(name,email),agent:assigned_agent_id(name,email)";

        SupabaseService.PaginatedResult result = supabaseService.selectPaginated(
                "tickets",
                select,
                filters,
                "created_at.desc",
                limit,
                offset
        );

        List<Map<String, Object>> formattedTickets = new ArrayList<>();
        if (result.data != null) {
            for (Map<String, Object> t : result.data) {
                Map<String, Object> formatted = new HashMap<>();
                formatted.put("id", t.get("id"));
                formatted.put("title", t.get("title"));
                formatted.put("category", t.get("category"));
                formatted.put("priority", t.get("priority"));
                formatted.put("status", t.get("status"));
                formatted.put("customer_id", t.get("customer_id"));
                
                Map<String, Object> customer = (Map<String, Object>) t.get("customer");
                formatted.put("customer_name", customer != null ? customer.get("name") : null);
                formatted.put("customer_email", customer != null ? customer.get("email") : null);

                formatted.put("assigned_agent_id", t.get("assigned_agent_id"));
                Map<String, Object> agent = (Map<String, Object>) t.get("agent");
                formatted.put("agent_name", agent != null ? agent.get("name") : null);
                formatted.put("agent_email", agent != null ? agent.get("email") : null);

                formatted.put("created_at", t.get("created_at"));
                formatted.put("updated_at", t.get("updated_at"));

                formattedTickets.add(formatted);
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("data", formattedTickets);
        response.put("page", page);
        response.put("limit", limit);
        response.put("total", result.total);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/agents")
    public ResponseEntity<List<Map<String, Object>>> getAgents(@RequestAttribute("user") Map<String, Object> user) {
        if (!isAdmin(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Map<String, String> agentFilter = Collections.singletonMap("role", "eq.agent");
        List<Map<String, Object>> agents = supabaseService.select("users", "id,name,email", agentFilter, null, null, null);

        Map<String, String> ticketFilter = new HashMap<>();
        // Fetch active tickets
        List<Map<String, Object>> tickets = supabaseService.select("tickets", "assigned_agent_id,status", null, null, null, null);

        Map<Long, Integer> countsMap = new HashMap<>();
        if (tickets != null) {
            for (Map<String, Object> t : tickets) {
                String status = (String) t.get("status");
                if (Arrays.asList("assigned", "in_progress").contains(status)) {
                    Object agentIdObj = t.get("assigned_agent_id");
                    if (agentIdObj != null) {
                        Long agentId = ((Number) agentIdObj).longValue();
                        countsMap.put(agentId, countsMap.getOrDefault(agentId, 0) + 1);
                    }
                }
            }
        }

        List<Map<String, Object>> result = new ArrayList<>();
        if (agents != null) {
            for (Map<String, Object> agent : agents) {
                Long agentId = ((Number) agent.get("id")).longValue();
                Map<String, Object> r = new HashMap<>();
                r.put("id", agentId);
                r.put("name", agent.get("name"));
                r.put("email", agent.get("email"));
                r.put("active_ticket_count", countsMap.getOrDefault(agentId, 0));
                result.add(r);
            }
        }

        result.sort((a, b) -> ((Integer) b.get("active_ticket_count")).compareTo((Integer) a.get("active_ticket_count")));
        return ResponseEntity.ok(result);
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats(@RequestAttribute("user") Map<String, Object> user) {
        if (!isAdmin(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        List<Map<String, Object>> tickets = supabaseService.select("tickets", "status,created_at,updated_at", null, null, null, null);
        if (tickets == null) {
            tickets = Collections.emptyList();
        }

        long total = tickets.size();
        long open = 0, assigned = 0, inProgress = 0, resolved = 0, closed = 0;
        long totalResolvedClosed = 0;
        double totalDays = 0.0;

        for (Map<String, Object> t : tickets) {
            String status = (String) t.get("status");
            if ("open".equals(status)) open++;
            else if ("assigned".equals(status)) assigned++;
            else if ("in_progress".equals(status)) inProgress++;
            else if ("resolved".equals(status)) resolved++;
            else if ("closed".equals(status)) closed++;

            if (Arrays.asList("resolved", "closed").contains(status)) {
                totalResolvedClosed++;
                Instant created = Instant.parse((String) t.get("created_at"));
                Instant updated = Instant.parse((String) t.get("updated_at"));
                long diffMs = Duration.between(created, updated).toMillis();
                double diffDays = diffMs / (1000.0 * 60.0 * 60.0 * 24.0);
                totalDays += Math.max(0.0, diffDays);
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

        List<Map<String, Object>> tickets = supabaseService.select("tickets", "status,priority,created_at,resolved_at,assigned_agent_id", null, null, null, null);
        if (tickets == null) {
            tickets = Collections.emptyList();
        }

        long totalTickets = tickets.size();
        long openTickets = 0, assignedTickets = 0, inProgressTickets = 0, resolvedTickets = 0, closedTickets = 0;
        long lowPriority = 0, mediumPriority = 0, highPriority = 0;

        long resolvedTicketsListCount = 0;
        long totalMs = 0;

        for (Map<String, Object> t : tickets) {
            String status = (String) t.get("status");
            if ("open".equals(status)) openTickets++;
            else if ("assigned".equals(status)) assignedTickets++;
            else if ("in_progress".equals(status)) inProgressTickets++;
            else if ("resolved".equals(status)) resolvedTickets++;
            else if ("closed".equals(status)) closedTickets++;

            String priority = (String) t.get("priority");
            if ("low".equals(priority)) lowPriority++;
            else if ("medium".equals(priority)) mediumPriority++;
            else if ("high".equals(priority)) highPriority++;

            String createdAtStr = (String) t.get("created_at");
            String resolvedAtStr = (String) t.get("resolved_at");
            if (createdAtStr != null && resolvedAtStr != null) {
                resolvedTicketsListCount++;
                Instant created = Instant.parse(createdAtStr);
                Instant resolvedTime = Instant.parse(resolvedAtStr);
                totalMs += Math.max(0, Duration.between(created, resolvedTime).toMillis());
            }
        }

        long averageResolutionTime = 0;
        if (resolvedTicketsListCount > 0) {
            averageResolutionTime = Math.round((double) totalMs / (1000.0 * 60.0 * resolvedTicketsListCount));
        }

        // Fetch agents
        Map<String, String> agentFilter = Collections.singletonMap("role", "eq.agent");
        List<Map<String, Object>> agents = supabaseService.select("users", "id,name,email", agentFilter, null, null, null);

        List<Map<String, Object>> agentWorkload = new ArrayList<>();
        if (agents != null) {
            for (Map<String, Object> agent : agents) {
                Long agentId = ((Number) agent.get("id")).longValue();
                long activeTickets = 0;
                for (Map<String, Object> t : tickets) {
                    Object agentIdObj = t.get("assigned_agent_id");
                    if (agentIdObj != null && ((Number) agentIdObj).longValue() == agentId) {
                        String status = (String) t.get("status");
                        if (Arrays.asList("assigned", "in_progress").contains(status)) {
                            activeTickets++;
                        }
                    }
                }
                Map<String, Object> w = new HashMap<>();
                w.put("id", agentId);
                w.put("name", agent.get("name") != null ? agent.get("name") : agent.get("email"));
                w.put("activeTickets", activeTickets);
                agentWorkload.add(w);
            }
        }
        agentWorkload.sort((a, b) -> ((Long) b.get("activeTickets")).compareTo((Long) a.get("activeTickets")));

        // Fetch recent tickets
        String select = "id,title,category,priority,status,created_at,customer:customer_id(name,email),agent:assigned_agent_id(name,email)";
        List<Map<String, Object>> recent = supabaseService.select("tickets", select, null, "created_at.desc", 10, null);

        List<Map<String, Object>> recentTickets = new ArrayList<>();
        if (recent != null) {
            for (Map<String, Object> t : recent) {
                Map<String, Object> formatted = new HashMap<>();
                formatted.put("id", t.get("id"));
                formatted.put("title", t.get("title"));
                formatted.put("category", t.get("category"));
                formatted.put("priority", t.get("priority"));
                formatted.put("status", t.get("status"));
                
                Map<String, Object> customer = (Map<String, Object>) t.get("customer");
                formatted.put("customer_name", customer != null ? customer.get("name") : null);
                formatted.put("customer_email", customer != null ? customer.get("email") : null);

                Map<String, Object> agent = (Map<String, Object>) t.get("agent");
                formatted.put("assigned_agent_name", agent != null ? agent.get("name") : null);
                formatted.put("assigned_agent_email", agent != null ? agent.get("email") : null);

                formatted.put("created_at", t.get("created_at"));
                recentTickets.add(formatted);
            }
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
