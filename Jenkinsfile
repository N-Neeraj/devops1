pipeline {
  agent any

  environment {
    AWS_REGION = 'us-east-1'
    AWS_ACCOUNT_ID = '396626623766'
    ECR_REPO = 'ci-cd-sample'
    IMAGE_TAG = "${env.BUILD_NUMBER}"
    ECR_URI = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"
    SUBNETS = 'subnet-0d2bf45bd1114b376'
    SECURITY_GROUPS = 'sg-0e0da67de7e196a4e'
  }

  stages {

    stage('Checkout') {
      steps {
        checkout([$class: 'GitSCM',
          branches: [[name: '*/main']],
          userRemoteConfigs: [[
            url: 'https://github.com/N-Neeraj/devops1.git',
            credentialsId: 'github-token'
          ]]
        ])
      }
    }

    stage('Build & Test') {
      steps {
        sh 'npm install'
        sh 'npm test || true'
      }
    }

    stage('Docker Build') {
      steps {
        sh "docker build -t ${ECR_REPO}:${IMAGE_TAG} ."
      }
    }

    stage('Login to ECR') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'aws-jenkins-creds',
          usernameVariable: 'AWS_ACCESS_KEY_ID',
          passwordVariable: 'AWS_SECRET_ACCESS_KEY')]) {

          sh '''
            aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID
            aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY
            aws configure set default.region ${AWS_REGION}

            aws ecr get-login-password --region ${AWS_REGION} \
            | docker login --username AWS --password-stdin ${ECR_URI}
          '''
        }
      }
    }

    stage('Tag & Push to ECR') {
      steps {
        sh "docker tag ${ECR_REPO}:${IMAGE_TAG} ${ECR_URI}:${IMAGE_TAG}"
        sh "docker push ${ECR_URI}:${IMAGE_TAG}"
      }
    }

    stage('(Optional) Push to Docker Hub') {
      when { expression { return false } } // change to true if needed
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds',
          usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {

          sh '''
            echo $DH_PASS | docker login --username $DH_USER --password-stdin
            docker tag ${ECR_REPO}:${IMAGE_TAG} $DH_USER/${ECR_REPO}:${IMAGE_TAG}
            docker push $DH_USER/${ECR_REPO}:${IMAGE_TAG}
          '''
        }
      }
    }

    stage('Register Task & Deploy to ECS') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'aws-jenkins-creds',
          usernameVariable: 'AWS_ACCESS_KEY_ID',
          passwordVariable: 'AWS_SECRET_ACCESS_KEY')]) {

          sh '''
            aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID
            aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY
            aws configure set default.region ${AWS_REGION}

            aws logs create-log-group --log-group-name /ecs/${ECR_REPO} 2>/dev/null || true

            cat > taskdef.json <<TASKDEF
            {
              "family": "${ECR_REPO}",
              "networkMode": "awsvpc",
              "requiresCompatibilities": ["FARGATE"],
              "cpu": "256",
              "memory": "512",
              "executionRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole",
              "containerDefinitions": [
                {
                  "name": "${ECR_REPO}",
                  "image": "${ECR_URI}:${IMAGE_TAG}",
                  "portMappings": [{"containerPort": 3000, "protocol": "tcp"}],
                  "essential": true,
                  "logConfiguration": {
                    "logDriver": "awslogs",
                    "options": {
                      "awslogs-group": "/ecs/${ECR_REPO}",
                      "awslogs-region": "${AWS_REGION}",
                      "awslogs-stream-prefix": "ecs"
                    }
                  }
                }
              ]
            }
            TASKDEF

            aws ecs register-task-definition --cli-input-json file://taskdef.json

            aws ecs create-cluster --cluster-name ${ECR_REPO} || true

            SERVICE=$(aws ecs describe-services --cluster ${ECR_REPO} --services ${ECR_REPO} --query 'services[0].status' --output text 2>/dev/null || true)

            if [ "$SERVICE" = "ACTIVE" ]; then
              aws ecs update-service --cluster ${ECR_REPO} --service ${ECR_REPO} --force-new-deployment
            else
              aws ecs create-service --cluster ${ECR_REPO} \
                --service-name ${ECR_REPO} \
                --task-definition ${ECR_REPO} \
                --desired-count 1 \
                --launch-type FARGATE \
                --network-configuration "awsvpcConfiguration={subnets=[${SUBNETS}],securityGroups=[${SECURITY_GROUPS}],assignPublicIp=ENABLED}"
            fi
          '''
        }
      }
    }

  }

  post {
    success {
      echo 'Pipeline succeeded — deployed to ECS!'
    }
    failure {
      echo 'Pipeline failed — check logs.'
    }
  }
}
