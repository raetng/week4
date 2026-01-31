# Jenkins Agent Configuration Guide

## Overview

This document describes the Jenkins agent setup for the Weather Reports CI/CD pipeline. We use a distributed build architecture with labeled agents to optimize workload distribution.

---

## Agent Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    JENKINS CONTROLLER                        │
│                    (Orchestration Only)                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│  Agent 1  │  │  Agent 2  │  │  Agent 3  │
│  (build)  │  │  (test)   │  │  (deploy) │
└───────────┘  └───────────┘  └───────────┘
```

---

## Agent Configuration

### Agent 1: Build Agent

| Property | Value |
|----------|-------|
| **Name** | `build-agent-01` |
| **Labels** | `build nodejs npm` |
| **Description** | Handles application builds and artifact creation |
| **# of Executors** | 2 |
| **Remote Root Directory** | `/var/jenkins/build-agent` |
| **Usage** | Only build jobs tied to this node |

**Required Software:**
- Node.js 18+ (LTS)
- npm 9+
- Git

**Setup Commands:**
```bash
# Install Node.js (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

---

### Agent 2: Test Agent

| Property | Value |
|----------|-------|
| **Name** | `test-agent-01` |
| **Labels** | `test testing e2e performance` |
| **Description** | Executes unit tests, E2E tests, and performance tests |
| **# of Executors** | 2 |
| **Remote Root Directory** | `/var/jenkins/test-agent` |
| **Usage** | Only test jobs tied to this node |

**Required Software:**
- Node.js 18+ (LTS)
- npm 9+
- Playwright dependencies
- k6 (for performance testing)
- Git

**Setup Commands:**
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Playwright system dependencies
npx playwright install-deps

# Install k6
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
    --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
    sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

---

### Agent 3: Deploy Agent

| Property | Value |
|----------|-------|
| **Name** | `deploy-agent-01` |
| **Labels** | `deploy deployment production staging` |
| **Description** | Handles deployments to staging and production |
| **# of Executors** | 1 |
| **Remote Root Directory** | `/var/jenkins/deploy-agent` |
| **Usage** | Only deploy jobs tied to this node |

**Required Software:**
- Docker
- kubectl (if using Kubernetes)
- SSH access to deployment targets
- Git

**Setup Commands:**
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker jenkins

# Verify Docker
docker --version
```

---

## Adding an Agent to Jenkins

### Step 1: Create Node in Jenkins

1. Navigate to **Manage Jenkins** → **Nodes** → **New Node**
2. Enter node name (e.g., `build-agent-01`)
3. Select **Permanent Agent**
4. Click **Create**

### Step 2: Configure Node

Fill in the configuration:

```
Name:                  build-agent-01
Description:           Build agent for Node.js applications
# of Executors:        2
Remote root directory: /var/jenkins/build-agent
Labels:                build nodejs npm
Usage:                 Only build jobs tied to this node
Launch method:         Launch agent via SSH
Host:                  <agent-ip-address>
Credentials:           <jenkins-ssh-credentials>
```

### Step 3: Agent Launch Methods

**Option A: SSH (Recommended for Linux agents)**
- Jenkins connects to agent via SSH
- Requires SSH credentials configured in Jenkins
- Agent starts automatically

**Option B: JNLP (Java Web Start)**
- Agent connects to controller
- Run on agent machine:
```bash
java -jar agent.jar -url http://jenkins-url/ \
    -secret <agent-secret> -name <agent-name> -workDir "/var/jenkins/agent"
```

**Option C: Docker Agent**
```yaml
# docker-compose.yml for Jenkins agent
version: '3.8'
services:
  jenkins-agent:
    image: jenkins/inbound-agent
    environment:
      - JENKINS_URL=http://jenkins-controller:8080
      - JENKINS_AGENT_NAME=build-agent-01
      - JENKINS_SECRET=<secret>
    volumes:
      - agent-workspace:/var/jenkins/agent
```

---

## Label-Based Pipeline Execution

### Using Labels in Jenkinsfile

```groovy
pipeline {
    agent none  // Don't allocate default agent

    stages {
        stage('Build') {
            agent { label 'build' }
            steps {
                sh 'npm ci'
                sh 'npm run build'
            }
        }

        stage('Test') {
            agent { label 'test' }
            steps {
                sh 'npm test'
            }
        }

        stage('Deploy') {
            agent { label 'deploy' }
            when {
                branch 'main'
            }
            steps {
                sh './deploy.sh'
            }
        }
    }
}
```

---

## Workload Distribution Strategy

| Stage | Agent Label | Rationale |
|-------|-------------|-----------|
| Checkout | Any | Git clone is lightweight |
| Install Dependencies | `build` | npm install requires disk I/O |
| Build | `build` | Compilation/bundling |
| Unit Tests | `test` | Isolated test environment |
| E2E Tests | `test` | Browser automation requires setup |
| Performance Tests | `test` | k6 load testing |
| SonarQube Analysis | `build` | Code analysis |
| Deploy to Staging | `deploy` | Deployment credentials |
| Deploy to Production | `deploy` | Production access |

---

## Monitoring Agent Status

### Jenkins UI
- **Manage Jenkins** → **Nodes** shows all agents
- Green = online, Red = offline
- Click agent name for detailed status

### CLI Check
```bash
# Using Jenkins CLI
java -jar jenkins-cli.jar -s http://localhost:8080/ \
    get-node build-agent-01

# List all nodes
java -jar jenkins-cli.jar -s http://localhost:8080/ \
    list-nodes
```

---

## Troubleshooting

### Agent Offline
1. Check network connectivity between controller and agent
2. Verify SSH credentials are valid
3. Check agent logs: `/var/log/jenkins/agent.log`
4. Restart agent service

### Build Stuck in Queue
- Message: "Waiting for next available executor on build"
- Solutions:
  1. Add more executors to agent
  2. Add another agent with same label
  3. Check if agent is offline

### Permission Errors
```bash
# Fix workspace permissions
sudo chown -R jenkins:jenkins /var/jenkins/build-agent
sudo chmod 755 /var/jenkins/build-agent
```

---

## Screenshots Reference

*Note: Add screenshots to `docs/screenshots/` directory*

1. `jenkins-agents-overview.png` - Nodes dashboard showing all agents
2. `agent-configuration.png` - Agent configuration page
3. `agent-labels.png` - Labels configuration
4. `agent-status.png` - Agent online status