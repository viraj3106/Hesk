package com.helpdesk;

import com.helpdesk.entity.Ticket;
import com.helpdesk.entity.User;
import com.helpdesk.repository.TicketRepository;
import com.helpdesk.repository.UserRepository;
import org.mindrot.jbcrypt.BCrypt;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import java.time.Instant;

@SpringBootApplication
public class HelpdeskApplication {
    public static void main(String[] args) {
        SpringApplication.run(HelpdeskApplication.class, args);
    }

    @Bean
    public CommandLineRunner initDatabase(UserRepository userRepository, TicketRepository ticketRepository) {
        return args -> {
            // Seed Admin if not exists
            if (userRepository.findByEmail("admin@resolvedesk.com").isEmpty()) {
                User admin = new User();
                admin.setName("System Administrator");
                admin.setEmail("admin@resolvedesk.com");
                admin.setPassword(BCrypt.hashpw("Admin@123456", BCrypt.gensalt(10)));
                admin.setRole("admin");
                admin.setCreatedAt(Instant.now().toString());
                userRepository.save(admin);
            }

            // Seed Support Agent if not exists
            if (userRepository.findByEmail("agent@resolvedesk.com").isEmpty()) {
                User agent = new User();
                agent.setName("Sarah Jenkins (Agent)");
                agent.setEmail("agent@resolvedesk.com");
                agent.setPassword(BCrypt.hashpw("Agent@123456", BCrypt.gensalt(10)));
                agent.setRole("agent");
                agent.setCreatedAt(Instant.now().toString());
                userRepository.save(agent);
            }

            // Seed Demo Customer if not exists
            if (userRepository.findByEmail("customer@resolvedesk.com").isEmpty()) {
                User customer = new User();
                customer.setName("John Customer");
                customer.setEmail("customer@resolvedesk.com");
                customer.setPassword(BCrypt.hashpw("Customer@123456", BCrypt.gensalt(10)));
                customer.setRole("customer");
                customer.setCreatedAt(Instant.now().toString());
                customer = userRepository.save(customer);

                // Seed a sample ticket
                if (ticketRepository.count() == 0) {
                    Ticket ticket = new Ticket();
                    ticket.setTitle("Cannot access VPN from remote branch");
                    ticket.setDescription("Attempted logging in to VPN network from Chicago branch. Error 403 authorization required.");
                    ticket.setCategory("Technical Issue");
                    ticket.setPriority("high");
                    ticket.setStatus("open");
                    ticket.setCreatedBy(customer.getId());
                    ticket.setCreatedAt(Instant.now().toString());
                    ticket.setUpdatedAt(Instant.now().toString());
                    ticketRepository.save(ticket);
                }
            }
        };
    }
}
