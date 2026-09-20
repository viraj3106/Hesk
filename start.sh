#!/bin/sh
# Start ResolveDesk Spring Boot Backend + Embedded Frontend
echo "Starting ResolveDesk on port ${PORT:-8080}..."
exec java -Dserver.port=${PORT:-8080} -Xmx384m -jar target/resolvedesk-1.0.0.jar
