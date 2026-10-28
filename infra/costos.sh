#!/usr/bin/env bash
# Mide el uso y el gasto real del mes en curso e imprime una fila para la tabla
# "Gasto real durante el evento" de docs/costos.md. Solo lee de la cuenta: no cambia nada.
# Uso: infra/costos.sh
# No imprime el número de cuenta (el repositorio es público).
set -euo pipefail
PILA=${PILA:-zombie-zero}
REGION=${AWS_REGION:-us-east-1}
PRESUPUESTO=${PRESUPUESTO:-$PILA-mensual}
PRECIO_GBS=0.0000166667   # Lambda x86 en us-east-1, por GB-s (ver docs/costos.md)

salida() {
  aws cloudformation describe-stacks --stack-name "$PILA" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

funcion=$(aws cloudformation describe-stack-resource --stack-name "$PILA" --region "$REGION" \
  --logical-resource-id ApiFunction --query StackResourceDetail.PhysicalResourceId --output text)
distribucion=$(salida FrontendDistributionId)
cuenta=$(aws sts get-caller-identity --query Account --output text)
memoria_mb=$(aws lambda get-function-configuration --function-name "$funcion" --region "$REGION" \
  --query MemorySize --output text)

inicio=$(date -u +%Y-%m-01T00:00:00Z)
fin=$(date -u +%Y-%m-%dT%H:%M:%SZ)
periodo=$((31 * 24 * 3600))

# Suma de una métrica de CloudWatch desde el inicio del mes (0 si no hay datos).
suma() {
  local espacio=$1 metrica=$2; shift 2
  aws cloudwatch get-metric-statistics --region "$REGION" --namespace "$espacio" --metric-name "$metrica" \
    --dimensions "$@" --start-time "$inicio" --end-time "$fin" --period "$periodo" --statistics Sum \
    --query 'sum(Datapoints[].Sum)' --output text
}

invocaciones=$(suma AWS/Lambda Invocations Name=FunctionName,Value="$funcion")
duracion_ms=$(suma AWS/Lambda Duration Name=FunctionName,Value="$funcion")
solicitudes_cf=$(suma AWS/CloudFront Requests Name=DistributionId,Value="$distribucion" Name=Region,Value=Global)
gasto=$(aws budgets describe-budget --account-id "$cuenta" --budget-name "$PRESUPUESTO" \
  --query 'Budget.CalculatedSpend.ActualSpend.Amount' --output text)

LC_NUMERIC=C awk -v fecha="$(TZ=America/Guayaquil date '+%d/%m/%Y %H:%M')" -v gasto="$gasto" \
  -v inv="$invocaciones" -v ms="$duracion_ms" -v mem="$memoria_mb" -v cf="$solicitudes_cf" -v precio="$PRECIO_GBS" '
  BEGIN {
    gbs = ms / 1000 * mem / 1024
    printf "| %s | $%.2f | %d | %.0f s × %.0f GB = %.0f GB-s | $%.4f | %d |\n",
      fecha, gasto, inv, ms / 1000, mem / 1024, gbs, gbs * precio, cf
  }'
