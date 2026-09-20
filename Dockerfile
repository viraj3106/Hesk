# Build Stage: Maven build for Spring Boot application with embedded static frontend
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# Runtime Stage: Lightweight, high-performance OpenJDK JRE
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Copy compiled JAR containing full backend and static frontend
COPY --from=build /app/target/*.jar ./resolvedesk.jar

# Environment defaults
ENV PORT=8080
EXPOSE 8080

# Run Spring Boot directly with memory optimization for cloud free tiers (Render/Railway/Fly.io/Docker)
ENTRYPOINT ["sh", "-c", "java -Dserver.port=${PORT:-8080} -Xmx384m -jar resolvedesk.jar"]
