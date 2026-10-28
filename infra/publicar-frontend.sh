#!/usr/bin/env bash
# Sube el build de Angular al bucket y limpia la caché de CloudFront.
# Uso: infra/publicar-frontend.sh frontend/dist/zombie-zero-ui/browser
set -euo pipefail
CARPETA=${1:?Indica la carpeta del build, por ejemplo frontend/dist/zombie-zero-ui/browser}
PILA=${PILA:-zombie-zero}
REGION=${AWS_REGION:-us-east-1}

salida() {
  aws cloudformation describe-stacks --stack-name "$PILA" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
BUCKET=$(salida FrontendBucketName)
DISTRIBUCION=$(salida FrontendDistributionId)

aws s3 sync "$CARPETA" "s3://$BUCKET" --delete --region "$REGION"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUCION" --paths "/*" >/dev/null
echo "Publicado en $(salida FrontendUrl)"
