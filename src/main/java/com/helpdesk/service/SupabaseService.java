package com.helpdesk.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.*;

@Service
@SuppressWarnings("unchecked")
public class SupabaseService {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.key}")
    private String supabaseKey;

    private final RestTemplate restTemplate = new RestTemplate(new HttpComponentsClientHttpRequestFactory());

    private HttpHeaders getHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", supabaseKey);
        headers.set("Authorization", "Bearer " + supabaseKey);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    public List<Map<String, Object>> select(String table, String select, Map<String, String> filters, String order, Integer limit, Integer offset) {
        HttpHeaders headers = getHeaders();
        
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(supabaseUrl + "/rest/v1/" + table);
        if (select != null) {
            builder.queryParam("select", select);
        }
        if (filters != null) {
            for (Map.Entry<String, String> entry : filters.entrySet()) {
                builder.queryParam(entry.getKey(), entry.getValue());
            }
        }
        if (order != null) {
            builder.queryParam("order", order);
        }
        if (limit != null) {
            builder.queryParam("limit", limit);
        }
        if (offset != null) {
            builder.queryParam("offset", offset);
        }

        HttpEntity<Void> entity = new HttpEntity<>(headers);
        ResponseEntity<List> response = restTemplate.exchange(
                builder.toUriString(),
                HttpMethod.GET,
                entity,
                List.class
        );
        return (List<Map<String, Object>>) response.getBody();
    }

    public Map<String, Object> selectSingle(String table, Map<String, String> filters) {
        List<Map<String, Object>> list = select(table, "*", filters, null, 1, null);
        if (list != null && !list.isEmpty()) {
            return list.get(0);
        }
        return null;
    }

    public static class PaginatedResult {
        public List<Map<String, Object>> data;
        public long total;
    }

    public PaginatedResult selectPaginated(String table, String select, Map<String, String> filters, String order, int limit, int offset) {
        HttpHeaders headers = getHeaders();
        headers.set("Prefer", "count=exact");

        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(supabaseUrl + "/rest/v1/" + table);
        if (select != null) {
            builder.queryParam("select", select);
        }
        if (filters != null) {
            for (Map.Entry<String, String> entry : filters.entrySet()) {
                builder.queryParam(entry.getKey(), entry.getValue());
            }
        }
        if (order != null) {
            builder.queryParam("order", order);
        }
        builder.queryParam("limit", limit);
        builder.queryParam("offset", offset);

        HttpEntity<Void> entity = new HttpEntity<>(headers);
        ResponseEntity<List> response = restTemplate.exchange(
                builder.toUriString(),
                HttpMethod.GET,
                entity,
                List.class
        );

        PaginatedResult result = new PaginatedResult();
        result.data = (List<Map<String, Object>>) response.getBody();
        
        String contentRange = response.getHeaders().getFirst("Content-Range");
        long total = 0;
        if (contentRange != null) {
            String[] parts = contentRange.split("/");
            if (parts.length > 1) {
                try {
                    total = Long.parseLong(parts[1].trim());
                } catch (Exception ignored) {}
            }
        }
        result.total = total;
        return result;
    }

    public Map<String, Object> insert(String table, Map<String, Object> body) {
        HttpHeaders headers = getHeaders();
        headers.set("Prefer", "return=representation");

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<List> response = restTemplate.exchange(
                supabaseUrl + "/rest/v1/" + table,
                HttpMethod.POST,
                entity,
                List.class
        );

        List<Map<String, Object>> list = (List<Map<String, Object>>) response.getBody();
        if (list != null && !list.isEmpty()) {
            return list.get(0);
        }
        return null;
    }

    public Map<String, Object> update(String table, Map<String, Object> body, Map<String, String> filters) {
        HttpHeaders headers = getHeaders();
        headers.set("Prefer", "return=representation");

        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(supabaseUrl + "/rest/v1/" + table);
        if (filters != null) {
            for (Map.Entry<String, String> entry : filters.entrySet()) {
                builder.queryParam(entry.getKey(), entry.getValue());
            }
        }

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<List> response = restTemplate.exchange(
                builder.toUriString(),
                HttpMethod.PATCH,
                entity,
                List.class
        );

        List<Map<String, Object>> list = (List<Map<String, Object>>) response.getBody();
        if (list != null && !list.isEmpty()) {
            return list.get(0);
        }
        return null;
    }
}
