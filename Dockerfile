# Build Stage for Java
FROM maven:3.8.6-openjdk-8 AS java-build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# Final Stage
FROM node:18-slim

# Install OpenJDK JRE (Java 17 is backwards-compatible and readily available in Debian package repositories)
RUN apt-get update && apt-get install -y openjdk-17-jre-headless && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built jar from java-build stage
COPY --from=java-build /app/target/resolvedesk-1.0.0.jar ./resolvedesk.jar

# Copy Node.js dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy proxy server and static files
COPY server.js ./
COPY public ./public

# Copy start script
COPY start.sh ./
RUN chmod +x start.sh

# Expose Node.js port (Railway will automatically route incoming traffic to PORT)
EXPOSE 3000

CMD ["./start.sh"]
