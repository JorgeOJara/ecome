# Use the regular Debian 18-bullseye-slim base image
FROM debian:bullseye-slim

# Install curl, Node.js, and npm from NodeSource, along with other necessary dependencies
RUN apt-get update && \
    apt-get install -y curl git build-essential && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm@10.9.0 && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy the current directory's contents to the /app directory in the container
COPY . .

# Update npm to 10.9.0 before running project npm install
RUN npm install -g npm@10.9.0

# Clean node_modules and package-lock.json to ensure a clean installation
RUN rm -rf node_modules package-lock.json && \
    npm install

# Expose the port that the application will run on
EXPOSE 3000

# Start the application using Node.js
CMD ["npm", "start"]
