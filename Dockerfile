# Use a Debian-based image
FROM debian:bullseye-slim

# Install Node.js, Git, and other dependencies
RUN apt-get update && \
    apt-get install -y curl git build-essential && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy the current directory's contents to the /app directory in the container
COPY . .

# Install project dependencies using npm
RUN npm install

# Expose the port that the application will run on
EXPOSE 3000

# Start the application using Node.js
CMD ["npm", "start"]
