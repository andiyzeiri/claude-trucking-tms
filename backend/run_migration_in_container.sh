#!/bin/bash
# Get the running task ID
TASK_ARN=$(aws ecs list-tasks --cluster trucking-tms-cluster --service-name trucking-tms-backend-service --region us-east-1 --query 'taskArns[0]' --output text)
TASK_ID=$(echo $TASK_ARN | rev | cut -d'/' -f1 | rev)

echo "Running migration in task: $TASK_ID"

# Run the migration script
aws ecs execute-command \
  --cluster trucking-tms-cluster \
  --task $TASK_ID \
  --container backend \
  --interactive \
  --command "python3 /app/remove_unique_constraint.py" \
  --region us-east-1
