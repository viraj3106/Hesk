package com.helpdesk.repository;

import com.helpdesk.entity.Ticket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long>, JpaSpecificationExecutor<Ticket> {
    List<Ticket> findByCustomerIdOrderByCreatedAtDesc(Long customerId);
    Page<Ticket> findByAssignedAgentIdOrderByUpdatedAtDesc(Long assignedAgentId, Pageable pageable);
    Page<Ticket> findByAssignedAgentIdAndStatusOrderByUpdatedAtDesc(Long assignedAgentId, String status, Pageable pageable);
    List<Ticket> findTop10ByOrderByCreatedAtDesc();
}
