#!/bin/bash

# SSL Certificate Setup Script for Claude TMS
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
DOMAIN_NAME=""
AWS_REGION="us-east-1"

show_help() {
    echo "SSL Certificate Setup for Claude TMS"
    echo ""
    echo "Usage: $0 -d <domain-name> [-r <aws-region>]"
    echo ""
    echo "Options:"
    echo "  -d, --domain     Domain name (e.g., example.com)"
    echo "  -r, --region     AWS region (default: us-east-1)"
    echo "  -h, --help       Show this help message"
    echo ""
    echo "Example:"
    echo "  $0 -d example.com -r us-east-1"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--domain)
            DOMAIN_NAME="$2"
            shift 2
            ;;
        -r|--region)
            AWS_REGION="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Validate inputs
if [ -z "$DOMAIN_NAME" ]; then
    echo -e "${RED}Error: Domain name is required${NC}"
    show_help
    exit 1
fi

echo -e "${GREEN}🔐 Setting up SSL certificate for ${DOMAIN_NAME}${NC}"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

# Check if Route 53 hosted zone exists
echo -e "${YELLOW}Checking Route 53 hosted zone...${NC}"
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
    --dns-name "${DOMAIN_NAME}" \
    --query "HostedZones[?Name=='${DOMAIN_NAME}.'].Id" \
    --output text \
    --region "${AWS_REGION}" | cut -d'/' -f3)

if [ -z "$HOSTED_ZONE_ID" ]; then
    echo -e "${YELLOW}Creating Route 53 hosted zone for ${DOMAIN_NAME}...${NC}"
    HOSTED_ZONE_ID=$(aws route53 create-hosted-zone \
        --name "${DOMAIN_NAME}" \
        --caller-reference "$(date +%s)" \
        --query 'HostedZone.Id' \
        --output text \
        --region "${AWS_REGION}" | cut -d'/' -f3)

    echo -e "${GREEN}✅ Created hosted zone: ${HOSTED_ZONE_ID}${NC}"
    echo -e "${YELLOW}⚠️  Please update your domain's nameservers with the following:${NC}"
    aws route53 get-hosted-zone --id "${HOSTED_ZONE_ID}" \
        --query 'DelegationSet.NameServers' \
        --output table \
        --region "${AWS_REGION}"
else
    echo -e "${GREEN}✅ Found existing hosted zone: ${HOSTED_ZONE_ID}${NC}"
fi

# Request SSL certificate
echo -e "${YELLOW}Requesting SSL certificate...${NC}"
CERTIFICATE_ARN=$(aws acm request-certificate \
    --domain-name "${DOMAIN_NAME}" \
    --subject-alternative-names "*.${DOMAIN_NAME}" \
    --validation-method DNS \
    --query 'CertificateArn' \
    --output text \
    --region "${AWS_REGION}")

echo -e "${GREEN}✅ Certificate requested: ${CERTIFICATE_ARN}${NC}"

# Wait for certificate validation details
echo -e "${YELLOW}Waiting for certificate validation details...${NC}"
sleep 10

# Get validation records
VALIDATION_RECORDS=$(aws acm describe-certificate \
    --certificate-arn "${CERTIFICATE_ARN}" \
    --query 'Certificate.DomainValidationOptions' \
    --output json \
    --region "${AWS_REGION}")

# Create DNS validation records
echo -e "${YELLOW}Creating DNS validation records...${NC}"
echo "${VALIDATION_RECORDS}" | jq -r '.[] | @base64' | while IFS= read -r record; do
    _jq() {
        echo "${record}" | base64 --decode | jq -r "${1}"
    }

    DOMAIN=$(_jq '.DomainName')
    NAME=$(_jq '.ResourceRecord.Name')
    VALUE=$(_jq '.ResourceRecord.Value')
    TYPE=$(_jq '.ResourceRecord.Type')

    # Remove trailing dot from NAME if present
    NAME=${NAME%.}

    echo "Creating validation record for ${DOMAIN}..."
    aws route53 change-resource-record-sets \
        --hosted-zone-id "${HOSTED_ZONE_ID}" \
        --change-batch "{
            \"Changes\": [{
                \"Action\": \"CREATE\",
                \"ResourceRecordSet\": {
                    \"Name\": \"${NAME}\",
                    \"Type\": \"${TYPE}\",
                    \"TTL\": 300,
                    \"ResourceRecords\": [{\"Value\": \"${VALUE}\"}]
                }
            }]
        }" \
        --region "${AWS_REGION}" >/dev/null

    echo -e "${GREEN}✅ Created validation record for ${DOMAIN}${NC}"
done

# Wait for certificate validation
echo -e "${YELLOW}Waiting for certificate validation (this may take several minutes)...${NC}"
aws acm wait certificate-validated \
    --certificate-arn "${CERTIFICATE_ARN}" \
    --region "${AWS_REGION}"

echo -e "${GREEN}🎉 SSL certificate validated successfully!${NC}"

# Output certificate information
echo ""
echo "Certificate Information:"
echo "======================="
echo "Domain: ${DOMAIN_NAME}"
echo "Certificate ARN: ${CERTIFICATE_ARN}"
echo "Hosted Zone ID: ${HOSTED_ZONE_ID}"
echo "Region: ${AWS_REGION}"
echo ""
echo -e "${YELLOW}💡 Add the following to your terraform.tfvars:${NC}"
echo "domain_name = \"${DOMAIN_NAME}\""
echo "certificate_arn = \"${CERTIFICATE_ARN}\""
echo ""
echo -e "${GREEN}✅ SSL setup complete!${NC}"