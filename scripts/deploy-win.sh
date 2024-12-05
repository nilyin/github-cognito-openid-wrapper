#!/bin/bash -eu

# Convert Windows paths to Git Bash compatible paths and add to PATH
AWSCLI_PATH="$(cd "/c/Program Files/Amazon/AWSCLIV2/bin" 2>/dev/null && pwd)"
AWSSAM_PATH="$(cd "/c/Program Files/Amazon/AWSSAMCLI/bin" 2>/dev/null && pwd)"
export PATH="$AWSCLI_PATH:$AWSSAM_PATH:$PATH"

# For Windows Git Bash, we need to use sam.cmd
function sam() {
    sam.cmd "$@"
}

# Fix the path resolution for Windows Git Bash - without using dirname
SCRIPT_DIR="$( cd "$( echo "${BASH_SOURCE[0]%/*}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Source the existing lib-robust-bash.sh
. "$SCRIPT_DIR/lib-robust-bash.sh"

# Modified check for required commands
command -v aws >/dev/null 2>&1 || { echo "ERROR: aws command not found"; exit 1; }
command -v sam.cmd >/dev/null 2>&1 || { echo "ERROR: sam command not found"; exit 1; }

# Ensure configuration is present
if [ ! -f "$PROJECT_ROOT/config.sh" ]; then
    echo "ERROR: config.sh is missing. Copy example-config.sh and modify as appropriate."
    echo "   cp example-config.sh config.sh"
    exit 1
fi
source "$PROJECT_ROOT/config.sh"

OUTPUT_TEMPLATE_FILE="$PROJECT_ROOT/serverless-output.yml"
aws s3 mb "s3://$BUCKET_NAME" --region "$REGION" || true
sam package --template-file template.yml --output-template-file "$OUTPUT_TEMPLATE_FILE"  --s3-bucket "$BUCKET_NAME"
sam deploy --region "$REGION" --template-file "$OUTPUT_TEMPLATE_FILE" --stack-name "$STACK_NAME" --parameter-overrides GitHubClientIdParameter="$GITHUB_CLIENT_ID" GitHubClientSecretParameter="$GITHUB_CLIENT_SECRET" CognitoRedirectUriParameter="$COGNITO_REDIRECT_URI" StageNameParameter="$STAGE_NAME" --capabilities CAPABILITY_IAM
