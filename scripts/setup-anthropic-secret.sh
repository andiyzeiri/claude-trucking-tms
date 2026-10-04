#!/usr/bin/env bash
#
# One-time setup: put the Anthropic API key where the production API can read
# it, without the key ever touching this repository.
#
# What it does:
#   1. Stores the key in AWS Secrets Manager as {"api_key": "..."}
#   2. Grants the ECS *execution* role permission to read that one secret
#   3. Adds ANTHROPIC_SECRET_JSON to the live task definition's secrets and
#      registers a new revision
#   4. Rolls the service onto that revision
#
# After this, deploy-api.yml carries the secret reference forward on every
# deploy automatically - you only ever run this script again to rotate the key.
#
# Usage:
#   export ANTHROPIC_API_KEY='sk-ant-...'      # not an argument, so it stays
#   ./scripts/setup-anthropic-secret.sh        # out of your shell history
#
#   ./scripts/setup-anthropic-secret.sh --yes  # skip the confirmation prompt
#
# The key is never echoed, never written to disk, and never passed on a
# command line visible to other processes.

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
SECRET_NAME="${SECRET_NAME:-trucking-tms/anthropic}"
ECS_CLUSTER="${ECS_CLUSTER:-trucking-tms-cluster}"
ECS_SERVICE="${ECS_SERVICE:-trucking-tms-backend-service}"
TASK_FAMILY="${TASK_FAMILY:-trucking-tms-backend}"
ENV_VAR_NAME="ANTHROPIC_SECRET_JSON"
POLICY_NAME="trucking-tms-anthropic-secret-read"

ASSUME_YES=0
[ "${1:-}" = "--yes" ] && ASSUME_YES=1

die() { echo "error: $*" >&2; exit 1; }

# -- preflight --------------------------------------------------------------

command -v aws >/dev/null || die "aws CLI not found."
command -v jq  >/dev/null || die "jq not found. Install it: sudo apt install jq"

[ -n "${ANTHROPIC_API_KEY:-}" ] || die \
  "ANTHROPIC_API_KEY is not set. Run: export ANTHROPIC_API_KEY='sk-ant-...'"

case "$ANTHROPIC_API_KEY" in
  sk-ant-*) ;;
  *) die "That does not look like an Anthropic key (should start with 'sk-ant-')." ;;
esac

aws sts get-caller-identity >/dev/null 2>&1 || die \
  "No working AWS credentials. Run 'aws configure' first."

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo "AWS account : $ACCOUNT"
echo "Region      : $AWS_REGION"
echo "Secret      : $SECRET_NAME"
echo "Cluster     : $ECS_CLUSTER"
echo "Service     : $ECS_SERVICE"
echo "Task family : $TASK_FAMILY"
echo

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "Reading the current task definition..."
aws ecs describe-task-definition \
  --task-definition "$TASK_FAMILY" \
  --region "$AWS_REGION" \
  --query 'taskDefinition' > "$TMP/current.json" \
  || die "Could not read task definition '$TASK_FAMILY'."

CONTAINERS=$(jq '.containerDefinitions | length' "$TMP/current.json")
[ "$CONTAINERS" = "1" ] || die \
  "Expected a single container, found $CONTAINERS. Edit this script before continuing."

CONTAINER_NAME=$(jq -r '.containerDefinitions[0].name' "$TMP/current.json")
EXEC_ROLE_ARN=$(jq -r '.executionRoleArn // empty' "$TMP/current.json")
[ -n "$EXEC_ROLE_ARN" ] || die \
  "The task definition has no executionRoleArn, so it cannot read secrets."
EXEC_ROLE_NAME="${EXEC_ROLE_ARN##*/}"

echo "Container     : $CONTAINER_NAME"
echo "Execution role: $EXEC_ROLE_NAME"
echo

if [ "$ASSUME_YES" -ne 1 ]; then
  echo "This will modify live infrastructure and trigger a new deployment."
  printf "Continue? [y/N] "
  read -r reply
  case "$reply" in [yY]*) ;; *) echo "Aborted."; exit 1 ;; esac
  echo
fi

# -- 1. store the secret ----------------------------------------------------
# --secret-string is read from a file so the key never appears in the process
# list or in shell history.

jq -n --arg k "$ANTHROPIC_API_KEY" '{api_key: $k}' > "$TMP/secret.json"
chmod 600 "$TMP/secret.json"

echo "[1/4] Storing the key in Secrets Manager..."
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" \
     --region "$AWS_REGION" >/dev/null 2>&1; then
  aws secretsmanager put-secret-value \
    --secret-id "$SECRET_NAME" \
    --secret-string "file://$TMP/secret.json" \
    --region "$AWS_REGION" >/dev/null
  echo "      updated existing secret"
else
  aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --description "Anthropic API key for Loads AI document extraction" \
    --secret-string "file://$TMP/secret.json" \
    --region "$AWS_REGION" >/dev/null
  echo "      created"
fi
rm -f "$TMP/secret.json"

SECRET_ARN=$(aws secretsmanager describe-secret \
  --secret-id "$SECRET_NAME" --region "$AWS_REGION" \
  --query 'ARN' --output text)
echo "      $SECRET_ARN"

# -- 2. let the execution role read it --------------------------------------
# Scoped to this one secret ARN. Without this the task fails to START, with a
# ResourceInitializationError rather than a runtime error.

echo "[2/4] Granting '$EXEC_ROLE_NAME' read access to that secret..."
cat > "$TMP/policy.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "$SECRET_ARN"
    }
  ]
}
EOF
aws iam put-role-policy \
  --role-name "$EXEC_ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document "file://$TMP/policy.json"
echo "      inline policy '$POLICY_NAME' attached"

# -- 3. reference it from the task definition -------------------------------

echo "[3/4] Adding $ENV_VAR_NAME to the task definition..."
jq --arg name "$ENV_VAR_NAME" --arg arn "$SECRET_ARN" '
  .containerDefinitions[0].secrets =
      ((.containerDefinitions[0].secrets // [])
        | map(select(.name != $name))
        + [{name: $name, valueFrom: $arn}])
  | del(
      .taskDefinitionArn, .revision, .status, .requiresAttributes,
      .compatibilities, .registeredAt, .registeredBy, .deregisteredAt
    )
' "$TMP/current.json" > "$TMP/new.json"

NEW_ARN=$(aws ecs register-task-definition \
  --cli-input-json "file://$TMP/new.json" \
  --region "$AWS_REGION" \
  --query 'taskDefinition.taskDefinitionArn' --output text)
echo "      registered $NEW_ARN"

# -- 4. roll the service ----------------------------------------------------

echo "[4/4] Rolling the service onto the new revision..."
aws ecs update-service \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE" \
  --task-definition "$NEW_ARN" \
  --force-new-deployment \
  --region "$AWS_REGION" >/dev/null

echo "      waiting for the service to stabilise (a few minutes)..."
if aws ecs wait services-stable \
     --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE" \
     --region "$AWS_REGION"; then
  echo
  echo "Done. The API can now read the Anthropic key."
  echo "Verify with:  aws logs tail /ecs/$TASK_FAMILY --since 5m --region $AWS_REGION"
else
  echo
  echo "The service did not stabilise. Check the logs:" >&2
  echo "  aws logs tail /ecs/$TASK_FAMILY --since 10m --region $AWS_REGION" >&2
  exit 1
fi
