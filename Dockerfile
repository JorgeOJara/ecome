# Use a Node.js image based on Debian
FROM node:18-slim

# Install additional dependencies (optional, based on your app needs)
RUN apt-get update && \
    apt-get install -y git && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Clone the project repository
RUN git clone https://github.com/JorgeOJara/ecome.git .

# Install project dependencies using npm
RUN npm install

# Expose the port that the application will run on
EXPOSE 3000

# Start the application using Node.js
CMD ["npm", "start"]
