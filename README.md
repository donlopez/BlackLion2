# Black Lion IT Capstone Project

## Overview
The **Black Lion Project** is an IT capstone project developed as part of a college course, focused on backend development and cloud deployment. This project handles data management, database connectivity, and efficient deployment practices using AWS services.

## Project Goal
The primary goal of the Black Lion Project is to create an **Event Planner** application where users can:
- Create, edit, and manage events.
- Track guest lists and assign event locations.
- Organize various event-related activities.

## Project Structure
This project uses a **Node.js** application containerized with **Docker** and deployed to **AWS Fargate** for scalable and managed container orchestration. The backend interacts with a **MySQL database** hosted on **Amazon RDS** to ensure reliability and security for data storage and access. **AWS CodePipeline** is also used to automate the deployment process.

## Process and Implementation

1. **Backend Development:**
   - Built using **Node.js**, the backend application handles all API requests, manages business logic, and establishes a connection to the RDS MySQL database.

2. **Database Configuration:**
   - Set up **Amazon RDS with MySQL** for secure, managed database hosting.
   - Configured database access and permissions to enable seamless communication with the Node.js application.

3. **Containerization with Docker:**
   - The Node.js application is containerized using **Docker** to create a portable, consistent environment for deployment.
   - Configured Docker to manage dependencies and ensure application consistency across different environments.

4. **Deployment to AWS Fargate and CodePipeline:**
   - Deployed the Docker container to **AWS Fargate**, allowing for a fully managed container orchestration service.
   - Configured **AWS CodePipeline** to automate the deployment process, enabling continuous integration and delivery for the application.

## Future Enhancements
- Implementing API Gateway with AWS Lambda to handle API requests.
- Adding monitoring and logging with AWS CloudWatch for enhanced operational insights.

## Technologies Used
- **Node.js** for backend application development.
- **MySQL on Amazon RDS** for database management.
- **Docker** for containerization.
- **AWS Fargate** for managed container deployment.
- **AWS CodePipeline** for automated deployment.