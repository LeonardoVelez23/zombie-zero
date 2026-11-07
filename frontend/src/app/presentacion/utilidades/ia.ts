import { InformeIa } from '../../dominio/modelos/resultado';

// Quién redactó un texto del asistente: se muestra siempre junto al texto.
export function etiquetaFuente(i: InformeIa): string {
  if (i.fuente === 'bedrock') return `Redactado por Amazon Bedrock (${i.modelo})`;
  if (i.fuente === 'groq') return `Redactado por Groq (${i.modelo})`;
  return 'Texto automático (sin IA)';
}
