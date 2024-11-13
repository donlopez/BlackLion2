# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json for efficient caching
COPY package.json package-lock.json ./

# Install dependencies (including bcrypt, to compile it correctly)
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Run the application
CMD ["npm", "start"]
