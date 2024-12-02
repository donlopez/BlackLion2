# Black Lion IT Capstone Project

## Overview
The **Black Lion Project** is an IT capstone project developed as part of a college course, focused on backend development and cloud deployment. This project handles data management, database connectivity, and efficient deployment practices using AWS services.

---

## Project Goal
The primary goal of the Black Lion Project is to create an **Event Planner** application where users can:
- Create, edit, and manage events.
- Track guest lists and assign event locations.
- Organize various event-related activities.

---

## Project Structure
This project uses a **Node.js** application deployed on an **AWS EC2 instance** (Kali Linux). The backend interacts with a **MySQL database** hosted on **Amazon RDS** to ensure reliability and security for data storage and access. **AWS CodePipeline** is used to automate the deployment process.

---

## Architecture Diagram
Below is the architecture diagram of the Black Lion IT Capstone Project deployment process:

![Black Lion Project Architecture Diagram](./src/assets/Event_Planner_Diagram.png)

### Workflow:
1. **Node.js Backend**: Hosted on a **Kali Linux EC2 Instance**, connected to **Amazon RDS (MySQL)** for database operations.
2. **PM2 Process Manager**: Ensures high availability of the backend services.
3. **Nginx**: Acts as a reverse proxy to manage incoming requests.
4. **AWS S3**: Stores static assets such as user-uploaded files.
5. **AWS CloudWatch**: Monitors logs and metrics for operational insights.
6. **CI/CD Pipeline**:
   - **GitHub**: Manages source code and version control.
   - **AWS CodePipeline**: Automates build and deployment processes.

---

## Process and Implementation

1. **Backend Development**:
   - Built using **Node.js**, the backend application handles all API requests, manages business logic, and establishes a connection to the RDS MySQL database.
   - Process manager **PM2** ensures high availability and uptime.
   - **Nginx** acts as a reverse proxy to handle incoming requests efficiently.

2. **Database Configuration**:
   - Set up **Amazon RDS with MySQL** for secure, managed database hosting.
   - Configured database access and permissions to enable seamless communication with the Node.js application.

3. **Logging and Monitoring**:
   - Configured **AWS CloudWatch** to capture application logs and provide monitoring for better operational insights.

4. **Deployment Process**:
   - The application is deployed to a **Kali Linux EC2 instance** running the Node.js application with PM2.
   - **AWS CodePipeline** is used to automate the deployment process, enabling continuous integration and delivery for the application.

5. **Networking Configuration**:
   - **AWS VPC** is used to isolate and secure the application network.
   - Subnets are configured for proper distribution of resources and connectivity.

6. **Storage**:
   - **S3 Bucket** is used for storing static assets like user-uploaded files or event-related data.

---

## Features
- **Compute Group**:
  - Node.js application deployed on a **Kali Linux EC2 instance**.
  - Process management using **PM2** and reverse proxy setup with **Nginx**.
- **Storage Group**:
  - **S3 Bucket** for storing static assets.
- **Security Group**:
  - **IAM Roles** to manage secure access to AWS resources.
  - **AWS Secrets Manager** for handling sensitive credentials.
- **Database Group**:
  - **Amazon RDS (MySQL)** for data storage.
- **Monitoring Group**:
  - **AWS CloudWatch** for capturing logs and monitoring infrastructure.
- **Networking Group**:
  - **AWS VPC** and **Subnets** for secure and efficient networking.
- **CI/CD Integration**:
  - Source code managed in **GitHub**.
  - **AWS CodePipeline** for automated builds and deployments.

---

## Removed Components
- **AWS Fargate**: The project no longer uses managed container orchestration.
- **AWS Lambda**: The application does not rely on serverless functions for handling API requests.

---

## Technologies Used
- **Node.js** for backend application development.
- **MySQL on Amazon RDS** for database management.
- **PM2** for process management.
- **Nginx** for reverse proxy.
- **Docker** for local testing.
- **AWS Services**: EC2, S3, RDS, IAM, Secrets Manager, CloudWatch, CodePipeline, VPC, Subnets.
- **GitHub** for version control and source code management.

---

## Future Enhancements
- Integrating a real-time notification system for event updates.
- Adding advanced analytics and reporting features.
- Expanding logging and monitoring for additional metrics with **AWS CloudWatch**.

---

## How to Deploy
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/donlopez/BlackLion2
   cd BlackLion2
