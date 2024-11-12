# Use the official AWS Lambda Node.js 16 base image
FROM public.ecr.aws/lambda/nodejs:16

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# Download the AWS Lambda Runtime Interface Emulator for local testing
ADD https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie /usr/local/bin/aws-lambda-rie
RUN chmod +x /usr/local/bin/aws-lambda-rie

# Set the Lambda runtime entry point to use the handler
ENTRYPOINT [ "/usr/local/bin/aws-lambda-rie", "node", "lambdaHandler.js" ]

