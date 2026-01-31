pipeline {
    agent none

    // ============================================
    // Q3: Webhook triggers - configure in Jenkins job
    // GitHub: Settings > Webhooks > Add webhook
    // URL: http://<jenkins-url>/github-webhook/
    // ============================================
    triggers {
        githubPush()  // Trigger on push via webhook
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
        // Runs on any available agent
        // ============================================
        stage('Checkout') {
            agent { label 'build' }
            steps {
                checkout scm
                script {
                    // Store branch info for later use
                    env.GIT_BRANCH_NAME = env.GIT_BRANCH?.replaceAll('origin/', '') ?: 'unknown'
                    env.GIT_COMMIT_SHORT = env.GIT_COMMIT?.take(7) ?: 'unknown'
                    echo "Building branch: ${env.GIT_BRANCH_NAME}"
                    echo "Commit: ${env.GIT_COMMIT_SHORT}"
                }
            }
        }

        // ============================================
        // STAGE: Install Dependencies
        // ============================================
        stage('Install Dependencies') {
            agent { label 'build' }
            steps {
                sh 'npm ci'
            }
        }

        // ============================================
        // STAGE: Lint & Format Check
        // Runs on ALL branches
        // ============================================
        stage('Lint & Format') {
            agent { label 'build' }
            steps {
                sh 'npm run lint'
                sh 'npm run format'
            }
        }

        // ============================================
        // STAGE: Unit Tests
        // Runs on ALL branches
        // ============================================
        stage('Unit Tests') {
            agent { label 'test' }
            steps {
                sh 'npm ci'
                sh 'npm run test:ci'
            }
            post {
                always {
                    // Publish test results if available
                    junit allowEmptyResults: true, testResults: 'coverage/junit.xml'
                    // Publish coverage report
                    publishHTML(target: [
                        allowMissing: true,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'coverage/lcov-report',
                        reportFiles: 'index.html',
                        reportName: 'Coverage Report'
                    ])
                }
            }
        }

        // ============================================
        // Q3: Branch-Specific Stages
        // Feature branches: Skip deployment stages
        // Main branch: Full pipeline with deployment
        // ============================================

        // ============================================
        // STAGE: Build & Package (Q4)
        // Runs on main and develop branches only
        // ============================================
        stage('Build & Package') {
            agent { label 'build' }
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                    branch 'develop'
                }
            }
            steps {
                script {
                    // Q4: Semantic versioning with build number
                    def packageJson = readJSON file: 'package.json'
                    def baseVersion = packageJson.version
                    env.BUILD_VERSION = "${baseVersion}-build.${env.BUILD_NUMBER}"

                    echo "Building version: ${env.BUILD_VERSION}"

                    // Create build info file
                    writeFile file: 'build-info.json', text: """{
    "version": "${env.BUILD_VERSION}",
    "branch": "${env.GIT_BRANCH_NAME}",
    "commit": "${env.GIT_COMMIT_SHORT}",
    "buildNumber": "${env.BUILD_NUMBER}",
    "buildTime": "${new Date().format('yyyy-MM-dd HH:mm:ss')}"
}"""
                }

                // Create distributable package
                sh '''
                    mkdir -p dist
                    cp -r app.js package*.json public dist/
                    cp -r database dist/
                    cp build-info.json dist/
                    tar -czf "${APP_NAME}-${BUILD_VERSION}.tar.gz" dist/
                '''
            }
            post {
                success {
                    // Q4: Archive artifacts in Jenkins
                    archiveArtifacts artifacts: '*.tar.gz', fingerprint: true
                    archiveArtifacts artifacts: 'build-info.json', fingerprint: true
                }
            }
        }

        // ============================================
        // STAGE: SonarQube Analysis (Q5)
        // Runs on main, develop, and PR branches
        // ============================================
        stage('SonarQube Analysis') {
            agent { label 'build' }
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                    branch 'develop'
                    changeRequest()  // PR branches
                }
            }
            steps {
                script {
                    // Run SonarQube scanner
                    withSonarQubeEnv('SonarQube') {
                        sh '''
                            npm ci
                            npm run test:ci || true
                            sonar-scanner \
                                -Dsonar.projectKey=${APP_NAME} \
                                -Dsonar.projectName="${APP_NAME}" \
                                -Dsonar.projectVersion=${BUILD_VERSION:-1.0.0} \
                                -Dsonar.sources=. \
                                -Dsonar.exclusions=node_modules/**,coverage/**,dist/**,tests/** \
                                -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                                -Dsonar.testExecutionReportPaths=coverage/test-report.xml
                        '''
                    }
                }
            }
        }

        // ============================================
        // STAGE: Quality Gate (Q5)
        // Fails pipeline if quality standards not met
        // ============================================
        stage('Quality Gate') {
            agent { label 'build' }
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                    branch 'develop'
                }
            }
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        // ============================================
        // STAGE: E2E Tests (Q7)
        // Runs on main branch only
        // ============================================
        stage('E2E Tests') {
            agent { label 'test' }
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                }
            }
            steps {
                sh '''
                    npm ci
                    npx playwright install --with-deps chromium
                    npm run test:e2e || true
                '''
            }
            post {
                always {
                    publishHTML(target: [
                        allowMissing: true,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'playwright-report',
                        reportFiles: 'index.html',
                        reportName: 'E2E Test Report'
                    ])
                }
            }
        }

        // ============================================
        // STAGE: Performance Tests (Q8)
        // Runs on main branch only
        // ============================================
        stage('Performance Tests') {
            agent { label 'test' }
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                }
            }
            steps {
                sh '''
                    # Start app in background for testing
                    npm ci
                    npm start &
                    APP_PID=$!
                    sleep 5

                    # Run k6 load test
                    k6 run --out json=k6-results.json tests/performance/load-test.js || true

                    # Stop app
                    kill $APP_PID || true
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'k6-results.json', allowEmptyArchive: true
                }
            }
        }

        // ============================================
        // STAGE: Deploy to Staging
        // Runs on main branch only
        // ============================================
        stage('Deploy to Staging') {
            agent { label 'deploy' }
            when {
                branch 'main'
            }
            steps {
                echo 'Deploying to staging environment...'
                // Add your deployment commands here
                // Example: sh './scripts/deploy-staging.sh'
                sh '''
                    echo "Deployment target: staging"
                    echo "Version: ${BUILD_VERSION}"
                    # Placeholder for actual deployment
                '''
            }
        }
    }

    // ============================================
    // Q9: Notifications
    // ============================================
    post {
        success {
            script {
                if (env.BRANCH_NAME == 'main' || env.BRANCH_NAME == 'master') {
                    // Slack notification for successful deployment
                    slackSend(
                        channel: '#deployments',
                        color: 'good',
                        message: """
:white_check_mark: *Deployment Successful*
*Job:* ${env.JOB_NAME}
*Build:* #${env.BUILD_NUMBER}
*Version:* ${env.BUILD_VERSION ?: 'N/A'}
*Branch:* ${env.GIT_BRANCH_NAME}
*Commit:* ${env.GIT_COMMIT_SHORT}
*Duration:* ${currentBuild.durationString.replace(' and counting', '')}
<${env.BUILD_URL}|View Build>
"""
                    )
                }
            }
        }
        failure {
            // Slack notification for failed builds
            slackSend(
                channel: '#deployments',
                color: 'danger',
                message: """
:x: *Build Failed*
*Job:* ${env.JOB_NAME}
*Build:* #${env.BUILD_NUMBER}
*Branch:* ${env.GIT_BRANCH_NAME ?: env.BRANCH_NAME}
*Commit:* ${env.GIT_COMMIT_SHORT ?: 'unknown'}
*Duration:* ${currentBuild.durationString.replace(' and counting', '')}
*Error:* Check console output for details
<${env.BUILD_URL}console|View Console Output>
"""
            )
        }
        unstable {
            slackSend(
                channel: '#deployments',
                color: 'warning',
                message: """
:warning: *Build Unstable*
*Job:* ${env.JOB_NAME}
*Build:* #${env.BUILD_NUMBER}
*Branch:* ${env.GIT_BRANCH_NAME ?: env.BRANCH_NAME}
Tests may have failed. <${env.BUILD_URL}|View Build>
"""
            )
        }
        always {
            // Clean up workspace
            node('build') {
                cleanWs()
            }
        }
    }
}