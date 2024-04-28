# Use Ubuntu as the base image
FROM ubuntu:latest

# Update the package list and install dependencies
RUN apt-get update && \
    apt-get install -y git npm vim && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install FFmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy the package.json, tsconfig.json, .env.example, and src folder into the Docker image
COPY package.json tsconfig.json .env.example ./
COPY src ./src

# Install npm dependencies
RUN npm install

# Expose port 3000
EXPOSE 3000

# Run the application
CMD ["npm", "run", "dev"]
