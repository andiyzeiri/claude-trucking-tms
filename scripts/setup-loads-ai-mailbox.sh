#!/usr/bin/env bash
#
# One-time setup: give the production API the mailbox credentials it needs to
# read email, and switch ingestion on.
#
# What it does:
#   1. Stores {"username","password"} in AWS Secrets Manager
#   2. Grants the ECS execution role permission to read that one secret
#   3. Adds LOADS_AI_IMAP_SECRET_JSON (secret) and LOADS_AI_INGESTION_ENABLED=true
#      (plain env) to the live task definition
#   4. Rolls the service onto the new revision
#
# Gmail / Google Workspace requires an App Password, not the account password:
#   Google Account -> Security -> 2-Step Verification -> App passwords
#
# Usage:
#   export LOADS_AI_IMAP_USERNAME='accounting@absolutetrucking.net'
#   export LOADS_AI_IMAP_PASSWORD='xxxxxxxxxxxxxxxx'    # 16-char app password
#   ./scripts/setup-loads-ai-mailbox.sh
#
#   ./scripts/setup-loads-ai-mailbox.sh --yes   # skip the confirmation prompt
#
#   For the driver POD inbox, prefix with MAILBOX_KIND=pod.
#
# Re-run it to rotate the app password.

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
# Two mailboxes: rate confirmations (new AI loads) and driver PODs.
#   ./scripts/setup-loads-ai-mailbox.sh                    -> ratecons mailbox
#   MAILBOX_KIND=pod ./scripts/setup-loads-ai-mailbox.sh   -> pods mailbox
MAILBOX_KIND="${MAILBOX_KIND:-ratecon}"
if [ "$MAILBOX_KIND" = "pod" ]; then
  SECRET_NAME="${SECRET_NAME:-trucking-tms/loads-ai-pod-mailbox}"
  SECRET_ENV_NAME="LOADS_AI_POD_IMAP_SECRET_JSON"
  POLICY_NAME="trucking-tms-loads-ai-pod-mailbox-read"
else
  SECRET_NAME="${SECRET_NAME:-trucking-tms/loads-ai-mailbox}"
  SECRET_ENV_NAME="LOADS_AI_IMAP_SECRET_JSON"
  POLICY_NAME="trucking-tms-loads-ai-mailbox-read"
fi
ECS_CLUSTER="${ECS_CLUSTER:-trucking-tms-cluster}"
ECS_SERVICE="${ECS_SERVICE:-trucking-tms-backend-service}"
TASK_FAMILY="${TASK_FAMILY:-trucking-tms-backend}"

ASSUME_YES=0
[ "${1:-}" = "--yes" ] && ASSUME_YES=1

die() { echo "error: $*" >&2; exit 1; }

command -v aws >/dev/null || die "aws CLI not found."
command -v jq  >/dev/null || die "jq not found. Install it: sudo apt install jq"

[ -n "${LOADS_AI_IMAP_USERNAME:-}" ] || die \
  "LOADS_AI_IMAP_USERNAME is not set (the mailbox address)."
[ -n "${LOADS_AI_IMAP_PASSWORD:-}" ] || die \
  "LOADS_AI_IMAP_PASSWORD is not set (Gmail App Password, not the account password)."

# Gmail app passwords are 16 characters, often shown in groups of four.
NORMALIZED_PW="${LOADS_AI_IMAP_PASSWORD// /}"
if [ ${#NORMALIZED_PW} -eq 16 ]; then
  echo "note: 16-character app password detected (spaces stripped if present)"
else
  echo "warning: that password is ${#NORMALIZED_PW} characters. Google App Passwords"
  echo "         are 16. A normal account password will NOT authenticate over IMAP."
fi

aws sts get-caller-identity >/dev/null 2>&1 || die \
  "No working AWS credentials. Run 'aws configure' first."

echo "AWS account : $(aws sts get-caller-identity --query Account --output text)"
echo "Region      : $AWS_REGION"
echo "Mailbox     : $LOADS_AI_IMAP_USERNAME"
echo "Secret      : $SECRET_NAME"
echo "Service     : $ECS_SERVICE"
echo

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

echo "Reading the current task definition..."
aws ecs describe-task-definition --task-definition "$TASK_FAMILY" \
  --region "$AWS_REGION" --query 'taskDefinition' > "$TMP/current.json" \
  || die "Could not read task definition '$TASK_FAMILY'."

CONTAINERS=$(jq '.containerDefinitions | length' "$TMP/current.json")
[ "$CONTAINERS" = "1" ] || die "Expected a single container, found $CONTAINERS."

EXEC_ROLE_ARN=$(jq -r '.executionRoleArn // empty' "$TMP/current.json")
[ -n "$EXEC_ROLE_ARN" ] || die "Task definition has no executionRoleArn."
EXEC_ROLE_NAME="${EXEC_ROLE_ARN##*/}"
echo "Execution role: $EXEC_ROLE_NAME"
echo

if [ "$ASSUME_YES" -ne 1 ]; then
  echo "This switches on automatic email reading. Once deployed, the API will"
  echo "log into that mailbox every few minutes and CREATE LOADS from what it"
  echo "finds, without further confirmation."
  printf "Continue? [y/N] "
  read -r reply
  case "$reply" in [yY]*) ;; *) echo "Aborted."; exit 1 ;; esac
  echo
fi

# -- 1. store the credentials ------------------------------------------------
jq -n --arg u "$LOADS_AI_IMAP_USERNAME" --arg p "$NORMALIZED_PW" \
  '{username: $u, password: $p}' > "$TMP/secret.json"
chmod 600 "$TMP/secret.json"

echo "[1/4] Storing mailbox credentials in Secrets Manager..."
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" \
     --region "$AWS_REGION" >/dev/null 2>&1; then
  aws secretsmanager put-secret-value --secret-id "$SECRET_NAME" \
    --secret-string "file://$TMP/secret.json" --region "$AWS_REGION" >/dev/null
  echo "      updated existing secret"
else
  aws secretsmanager create-secret --name "$SECRET_NAME" \
    --description "Loads AI mailbox credentials (IMAP app password)" \
    --secret-string "file://$TMP/secret.json" --region "$AWS_REGION" >/dev/null
  echo "      created"
fi
rm -f "$TMP/secret.json"

SECRET_ARN=$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" \
  --region "$AWS_REGION" --query 'ARN' --output text)
echo "      $SECRET_ARN"

# -- 2. let the execution role read it --------------------------------------
echo "[2/4] Granting '$EXEC_ROLE_NAME' read access..."
jq -n --arg arn "$SECRET_ARN" '{
  Version: "2012-10-17",
  Statement: [{Effect: "Allow", Action: "secretsmanager:GetSecretValue", Resource: $arn}]
}' > "$TMP/policy.json"
aws iam put-role-policy --role-name "$EXEC_ROLE_NAME" \
  --policy-name "$POLICY_NAME" --policy-document "file://$TMP/policy.json"
echo "      inline policy '$POLICY_NAME' attached"

# -- 3. reference it, and switch ingestion on -------------------------------
echo "[3/4] Updating the task definition..."
jq --arg sname "$SECRET_ENV_NAME" --arg arn "$SECRET_ARN" '
  .containerDefinitions[0].secrets =
      ((.containerDefinitions[0].secrets // [])
        | map(select(.name != $sname)) + [{name: $sname, valueFrom: $arn}])
  | .containerDefinitions[0].environment =
      ((.containerDefinitions[0].environment // [])
        | map(select(.name != "LOADS_AI_INGESTION_ENABLED"))
        + [{name: "LOADS_AI_INGESTION_ENABLED", value: "true"}])
  | del(.taskDefinitionArn, .revision, .status, .requiresAttributes,
        .compatibilities, .registeredAt, .registeredBy, .deregisteredAt)
' "$TMP/current.json" > "$TMP/new.json"

NEW_ARN=$(aws ecs register-task-definition --cli-input-json "file://$TMP/new.json" \
  --region "$AWS_REGION" --query 'taskDefinition.taskDefinitionArn' --output text)
echo "      registered $NEW_ARN"

# -- 4. roll ----------------------------------------------------------------
echo "[4/4] Rolling the service..."
aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" \
  --task-definition "$NEW_ARN" --force-new-deployment \
  --region "$AWS_REGION" >/dev/null
echo "      waiting for the service to stabilise (a few minutes)..."
if aws ecs wait services-stable --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE" \
     --region "$AWS_REGION"; then
  echo
  echo "Done. Automatic email reading is live."
  echo
  echo "Next:"
  echo "  - Make sure the Source mailbox field on the Loads AI page is set to"
  echo "    $LOADS_AI_IMAP_USERNAME, or nothing will be ingested."
  echo "  - Use 'Check email now' on that page to run a cycle immediately."
  echo "  - Watch it:  aws logs tail /ecs/$TASK_FAMILY --since 5m --region $AWS_REGION | grep loads-ai"
else
  echo
  echo "The service did not stabilise. Check the logs:" >&2
  echo "  aws logs tail /ecs/$TASK_FAMILY --since 10m --region $AWS_REGION" >&2
  exit 1
fi
