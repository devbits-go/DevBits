# Use the official Golang image to create a build artifact.
# This is known as a multi-stage build.
FROM golang:1.24-alpine as builder

# Set the Current Working Directory inside the container
WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download all dependencies. Dependencies will be cached if the go.mod and go.sum files are not changed
RUN go mod download

# Copy the source code from the current directory to the Working Directory inside the container
COPY . .

# Build the Go app
# -o /app/main: output the executable to /app/main
# CGO_ENABLED=0: disable CGO for a statically linked binary
# GOOS=linux: build for Linux
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/main ./api

# Start a new stage from scratch for a smaller image
FROM alpine:latest

WORKDIR /root/

# Copy the Pre-built binary file from the previous stage
COPY --from=builder /app/main .

# Copy the database file
COPY --from=builder /app/api/internal/database/dev.sqlite3 ./api/internal/database/
COPY --from=builder /app/api/internal/database/create_tables.sql ./api/internal/database/

# Copy the uploads directory
# Note: This assumes your application needs access to this directory.
# If it's for temporary uploads, you might want to use a Docker volume instead.
COPY --from=builder /app/uploads ./uploads

# Expose port 8080 to the outside world
EXPOSE 8080

# Command to run the executable
CMD ["./main"]
