#!/usr/bin/env bash
# Despliega el backend, el bucket del frontend, CloudFront y el Budget.
# Uso: CORREO_ALERTA=equipo@ejemplo.com infra/desplegar.sh
# Requiere: AWS CLI con sesión iniciada (aws sso login), SAM CLI y uv.
set -euo pipefail
cd "$(dirname "$0")"
PILA=${PILA:-zombie-zero}
REGION=${AWS_REGION:-us-east-1}

./empaquetar.sh
sam deploy \
  --template-file template.yaml \
  --stack-name "$PILA" \
  --region "$REGION" \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides "CorreoAlerta=${CORREO_ALERTA:-}"

aws cloudformation describe-stacks --stack-name "$PILA" --region "$REGION" \
  --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output table
