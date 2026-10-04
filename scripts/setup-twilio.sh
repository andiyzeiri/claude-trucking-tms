#!/usr/bin/env bash
#
# One-time setup: give the production API the Twilio credentials it needs to
# text drivers for PODs, and switch the POD reminder job on in DRY-RUN mode.
#
# What it does:
#   1. Asks for the Account SID, Auth Token (hidden), Messaging Service SID
#      and phone number, and stores them in Secrets Manager as JSON
#   2. Grants the ECS *execution* role permission to read that one secret
#   3. Adds TWILIO_SECRET_JSON to the task definition, plus
#        POD_REMINDERS_ENABLED=true
#        POD_REMINDERS_DRY_RUN=true      (logs who WOULD be texted; sends nothing)
#        POD_REMINDERS_COMPANY_ID=<id>
#   4. Rolls the service onto that revision
#
# deploy-api.yml carries all of this forward on every deploy. To go live
# later, run:  ./scripts/setup-twilio.sh --go-live   (flips DRY_RUN to false)
#
# Usage:
#   ./scripts/setup-twilio.sh             # prompts for the credentials
#   ./scripts/setup-twilio.sh --go-live   # only switch dry-run off

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
SECRET_NAME="${SECRET_NAME:-trucking-tms/twilio}"
ECS_CLUSTER="${ECS_CLUSTER:-trucking-tms-cluster}"
ECS_SERVICE="${ECS_SERVICE:-trucking-tms-backend-service}"
TASK_FAMILY="${TASK_FAMILY:-trucking-tms-backend}"
COMPANY_ID="${POD_REMINDERS_COMPANY_ID:-1}"
ENV_VAR_NAME="TWILIO_SECRET_JSON"
POLICY_NAME="trucking-tms-twilio-secret-read"

MODE="setup"
[ "${1:-}" = "--go-live" ] && MODE="go-live"

die() { echo "error: $*" >&2; exit 1; }

command -v aws >/dev/null || die "aws CLI not found."
command -v jq  >/dev/null || die "jq not found."
aws sts get-caller-identity >/dev/null 2>&1 || die "No working AWS credentials. Run 'aws configure' first."

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

aws ecs describe-task-definition --task-definition "$TASK_FAMILY" --region "$AWS_REGION" \
  --query 'taskDefinition' > "$TMP/current.json" || die "Could not read task definition '$TASK_FAMILY'."
[ "$(jq '.containerDefinitions | length' "$TMP/current.json")" = "1" ] || die "Expected a single container."
EXEC_ROLE_ARN=$(jq -r '.executionRoleArn // empty' "$TMP/current.json")
[ -n "$EXEC_ROLE_ARN" ] || die "The task definition has no executionRoleArn."
EXEC_ROLE_NAME="${EXEC_ROLE_ARN##*/}"

set_env() {  # set_env NAME VALUE  (edits $TMP/new.json in place)
  jq --arg n "$1" --arg v "$2" '
    .containerDefinitions[0].environment =
      ((.containerDefinitions[0].environment // []) | map(select(.name != $n)) + [{name: $n, value: $v}])
  ' "$TMP/new.json" > "$TMP/x.json" && mv "$TMP/x.json" "$TMP/new.json"
}

strip_readonly() {
  jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy, .deregisteredAt)'
}

roll() {
  NEW_ARN=$(aws ecs register-task-definition --cli-input-json "file://$TMP/new.json" --region "$AWS_REGION" \
    --query 'taskDefinition.taskDefinitionArn' --output text)
  echo "      registered $NEW_ARN"
  echo "Rolling the service (a few minutes)..."
  aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" --task-definition "$NEW_ARN" \
    --force-new-deployment --region "$AWS_REGION" >/dev/null
  aws ecs wait services-stable --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE" --region "$AWS_REGION" \
    && echo "Done." || { echo "Service did not stabilise; check: aws logs tail /ecs/$TASK_FAMILY --since 10m" >&2; exit 1; }
}

if [ "$MODE" = "go-live" ]; then
  strip_readonly < "$TMP/current.json" > "$TMP/new.json"
  jq -e '.containerDefinitions[0].secrets // [] | map(.name) | index("TWILIO_SECRET_JSON")' "$TMP/new.json" >/dev/null \
    || die "Twilio is not set up yet. Run ./scripts/setup-twilio.sh first."
  echo "Switching POD reminders from dry-run to LIVE: drivers will start receiving texts."
  printf "Type GO LIVE to continue: "; read -r reply
  [ "$reply" = "GO LIVE" ] || { echo "Aborted."; exit 1; }
  set_env POD_REMINDERS_DRY_RUN false
  roll
  exit 0
fi

echo "Paste each value from the Twilio Console and press Enter."
read -rp  "  Account SID (starts AC):            " SID
read -rsp "  Auth Token (hidden as you type):    " TOKEN; echo
read -rp  "  Messaging Service SID (starts MG):  " MG
read -rp  "  Phone number (e.g. +13125550142):   " PHONE
case "$SID" in AC*) ;; *) die "Account SID should start with AC." ;; esac
case "$MG"  in MG*) ;; *) die "Messaging Service SID should start with MG." ;; esac
[ ${#TOKEN} -ge 32 ] || die "That Auth Token looks too short."

jq -n --arg a "$SID" --arg t "$TOKEN" --arg m "$MG" --arg p "$PHONE" \
  '{account_sid: $a, auth_token: $t, messaging_service_sid: $m, phone_number: $p}' > "$TMP/secret.json"
chmod 600 "$TMP/secret.json"
unset TOKEN

echo "[1/4] Storing credentials in Secrets Manager ($SECRET_NAME)..."
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
  aws secretsmanager put-secret-value --secret-id "$SECRET_NAME" --secret-string "file://$TMP/secret.json" --region "$AWS_REGION" >/dev/null
else
  aws secretsmanager create-secret --name "$SECRET_NAME" --description "Twilio credentials for driver POD texts" \
    --secret-string "file://$TMP/secret.json" --region "$AWS_REGION" >/dev/null
fi
rm -f "$TMP/secret.json"
SECRET_ARN=$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" --query ARN --output text)

echo "[2/4] Granting $EXEC_ROLE_NAME read access..."
jq -n --arg arn "$SECRET_ARN" '{Version:"2012-10-17",Statement:[{Effect:"Allow",Action:"secretsmanager:GetSecretValue",Resource:$arn}]}' > "$TMP/policy.json"
aws iam put-role-policy --role-name "$EXEC_ROLE_NAME" --policy-name "$POLICY_NAME" --policy-document "file://$TMP/policy.json"

echo "[3/4] Updating the task definition (dry-run ON)..."
jq --arg name "$ENV_VAR_NAME" --arg arn "$SECRET_ARN" '
  .containerDefinitions[0].secrets = ((.containerDefinitions[0].secrets // []) | map(select(.name != $name)) + [{name: $name, valueFrom: $arn}])
' "$TMP/current.json" | strip_readonly > "$TMP/new.json"
set_env POD_REMINDERS_ENABLED true
set_env POD_REMINDERS_DRY_RUN true
set_env POD_REMINDERS_COMPANY_ID "$COMPANY_ID"

echo "[4/4]"
roll
echo
echo "POD reminders are ON in dry-run: nothing is texted yet."
echo "Next: point the Twilio Messaging Service's incoming webhook at"
echo "      https://absolutetms.com/api/v1/sms/inbound   (HTTP POST)"
