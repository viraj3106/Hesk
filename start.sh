#!/bin/sh

# Start the Spring Boot backend in the background
# We pass -Dserver.port to override server.port configuration dynamically and avoid port conflicts with the Node.js frontend.
echo "Starting Spring Boot backend on port ${SPRING_BOOT_PORT:-8080}..."
java -Dserver.port=${SPRING_BOOT_PORT:-8080} -jar resolvedesk.jar &

# Start the Node.js reverse proxy in the foreground
echo "Starting Node.js proxy on port ${PORT:-3000}..."
npm start
