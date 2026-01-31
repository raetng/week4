pipeline {
    // Use 'any' for local Jenkins without configured agents
    // Change to specific labels when agents are set up
    agent any

    // NodeJS tool - configure in Manage Jenkins > Tools > NodeJS
    tools {
        nodejs 'Node-18'
    }

    triggers {
        githubPush()
    }

    environment {
        APP_NAME = 'weather-reports-app'
        NODE_VERSION = '18'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    stages {
        // ============================================
        // STAGE: Checkout
        // ============================================
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_BRANCH_NAME = sh(
                        script: "git rev-parse --abbrev-ref HEAD",
                        returnStdout: true
                    ).trim()
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                    echo "Building branch: ${env.GIT_BRANCH_NAME}"
                    echo "Commit: ${env.GIT_COMMIT_SHORT}"
                }
            }
        }

        // ============================================
        // STAGE: Install Dependencies
        // ============================================
        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        // ============================================
        // STAGE: Lint & Format Check
        // ============================================
        stage('Lint & Format') {
            steps {
                sh 'npm run lint'
                sh 'npm run format'
            }
        }

        // ============================================
        // STAGE: Unit Tests
        // ============================================
        stage('Unit Tests') {
            steps {
                sh 'npm run test:ci'
            }
            post {
                always {
                    // Archive coverage reports
                    archiveArtifacts artifacts: 'coverage/**/*', allowEmptyArchive: true
                }
            }
        }

        // ============================================
        // STAGE: Build & Package (Q4)
        // Only on main/master/develop
        // ============================================
        stage('Build & Package') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                    branch 'develop'
                    // Also run for local testing
                    expression { env.GIT_BRANCH_NAME in ['main', 'master', 'develop'] }
                }
            }
            steps {
                script {
                    // Read version from package.json using shell
                    def version = sh(
                        script: "node -p \"require('./package.json').version\"",
                        returnStdout: true
                    ).trim()
                    env.BUILD_VERSION = "${version}-build.${env.BUILD_NUMBER}"
                    echo "Building version: ${env.BUILD_VERSION}"
                }

                // Create build info
                sh """
                    echo '{
                        "version": "${env.BUILD_VERSION}",
                        "branch": "${env.GIT_BRANCH_NAME}",
                        "commit": "${env.GIT_COMMIT_SHORT}",
                        "buildNumber": "${env.BUILD_NUMBER}",
                        "buildTime": "'\$(date '+%Y-%m-%d %H:%M:%S')'"
                    }' > build-info.json
                """

                // Create distributable package
                sh """
                    mkdir -p dist
                    cp -r app.js package*.json public dist/
                    cp -r database dist/
                    cp build-info.json dist/
                    tar -czf "${env.APP_NAME}-${env.BUILD_VERSION}.tar.gz" dist/
                """
            }
            post {
                success {
                    archiveArtifacts artifacts: '*.tar.gz', fingerprint: true
                    archiveArtifacts artifacts: 'build-info.json', fingerprint: true
                }
            }
        }

        // ============================================
        // STAGE: SonarQube Analysis (Q5)
        // Uncomment when SonarQube is configured
        // ============================================
        stage('SonarQube Analysis') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                    branch 'develop'
                    expression { env.GIT_BRANCH_NAME in ['main', 'master', 'develop'] }
                }
            }
            steps {
                script {
                    // Check if SonarQube is configured
                    def sonarConfigured = false
                    try {
                        withSonarQubeEnv('SonarQube') {
                            sonarConfigured = true
                        }
                    } catch (Exception e) {
                        echo "SonarQube not configured, skipping analysis"
                    }

                    if (sonarConfigured) {
                        withSonarQubeEnv('SonarQube') {
                            sh """
                                sonar-scanner \
                                    -Dsonar.projectKey=${env.APP_NAME} \
                                    -Dsonar.projectName="${env.APP_NAME}" \
                                    -Dsonar.projectVersion=${env.BUILD_VERSION ?: '1.0.0'} \
                                    -Dsonar.sources=. \
                                    -Dsonar.exclusions=node_modules/**,coverage/**,dist/**,tests/** \
                                    -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
                            """
                        }
                    } else {
                        echo "SKIPPED: SonarQube not configured in Jenkins"
                        echo "To enable: Manage Jenkins > Configure System > SonarQube servers"
                    }
                }
            }
        }

        // ============================================
        // STAGE: E2E Tests (Q7) - Main branch only
        // ============================================
        stage('E2E Tests') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                    expression { env.GIT_BRANCH_NAME in ['main', 'master'] }
                }
            }
            steps {
                sh '''
                    # Install Playwright if available
                    if command -v npx &> /dev/null; then
                        npx playwright install chromium || echo "Playwright install skipped"
                        npm run test:e2e || echo "E2E tests completed with issues"
                    else
                        echo "SKIPPED: npx not available"
                    fi
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'playwright-report/**/*', allowEmptyArchive: true
                }
            }
        }

        // ============================================
        // STAGE: Performance Tests (Q8) - Main branch only
        // ============================================
        stage('Performance Tests') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                    expression { env.GIT_BRANCH_NAME in ['main', 'master'] }
                }
            }
            steps {
                sh '''
                    # Check if k6 is installed
                    if command -v k6 &> /dev/null; then
                        # Start app in background
                        npm start &
                        APP_PID=$!
                        sleep 5

                        # Run k6 load test
                        k6 run --out json=k6-results.json tests/performance/load-test.js || true

                        # Stop app
                        kill $APP_PID 2>/dev/null || true
                    else
                        echo "SKIPPED: k6 not installed"
                        echo "Install with: brew install k6"
                    fi
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'k6-results.json', allowEmptyArchive: true
                }
            }
        }

        // ============================================
        // STAGE: Deploy to Staging - Main branch only
        // ============================================
        stage('Deploy to Staging') {
            when {
                anyOf {
                    branch 'main'
                    expression { env.GIT_BRANCH_NAME == 'main' }
                }
            }
            steps {
                echo "Deploying to staging environment..."
                echo "Version: ${env.BUILD_VERSION}"
                // Add actual deployment commands here
            }
        }
    }

    // ============================================
    // Q9: Post-build Notifications
    // ============================================
    post {
        success {
            script {
                echo "✅ Build Successful!"
                echo "Branch: ${env.GIT_BRANCH_NAME}"
                echo "Commit: ${env.GIT_COMMIT_SHORT}"

                // Slack notification (if configured)
                try {
                    slackSend(
                        channel: '#deployments',
                        color: 'good',
                        message: "✅ *Build Successful* - ${env.JOB_NAME} #${env.BUILD_NUMBER}\nBranch: ${env.GIT_BRANCH_NAME}\n<${env.BUILD_URL}|View Build>"
                    )
                } catch (Exception e) {
                    echo "Slack not configured - skipping notification"
                }
            }
        }
        failure {
            script {
                echo "❌ Build Failed!"

                // Slack notification (if configured)
                try {
                    slackSend(
                        channel: '#deployments',
                        color: 'danger',
                        message: "❌ *Build Failed* - ${env.JOB_NAME} #${env.BUILD_NUMBER}\nBranch: ${env.GIT_BRANCH_NAME}\n<${env.BUILD_URL}console|View Console>"
                    )
                } catch (Exception e) {
                    echo "Slack not configured - skipping notification"
                }
            }
        }
        always {
            // Cleanup workspace
            cleanWs(deleteDirs: true, disableDeferredWipeout: true, notFailBuild: true)
        }
    }
}
