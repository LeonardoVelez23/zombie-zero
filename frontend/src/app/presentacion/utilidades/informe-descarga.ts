import { SimulacionGuardada } from '../../dominio/modelos/resultado';
import { capitalizar, numero, porcentaje } from './formato';

const NIVELES: Record<string, string> = {
  solida: 'sólida',
  debil: 'débil',
  insuficiente: 'insuficiente',
};

// Propiedades que se copian de los estilos calculados a cada elemento de una gráfica: los estilos
// del componente no viajan con el SVG al documento del informe.
const ESTILOS_SVG = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'display',
  'visibility',
];

export interface GraficaInforme {
  titulo: string;
  svg: string;
  // HTML de la leyenda (de capturarLeyenda): qué color es cada serie.
  leyenda?: string;
}

export interface ExtrasInforme {
  operador?: string;
  alcalde?: string | null;
  graficas?: GraficaInforme[];
}

const escapar = (texto: string): string =>
  texto.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

// Informe de una simulación guardada como página para imprimir o guardar en PDF.
export function informeHtml(s: SimulacionGuardada, extras: ExtrasInforme = {}): string {
  const { plaga: p, recursos: r } = s;
  const recomendado = s.planes.find((plan) => plan.id === s.recomendado);
  const corte = r.corteDias
    ? `sin vacunas desde el día ${r.corteDesde} durante ${r.corteDias} días`
    : 'ninguno';
  const confianza =
    (s.nivel ? (NIVELES[s.nivel] ?? s.nivel) : '—') +
    (s.ganaAAzar === null
      ? ''
      : ` · gana al reparto al azar en ${porcentaje(s.ganaAAzar)} de los brotes con diferencia`);
  const planes = s.planes
    .map((plan) => {
      const etiqueta =
        plan.id === s.recomendado
          ? ' <b>(recomendado)</b>'
          : plan.tipo === 'linea_base'
            ? ' (línea base)'
            : '';
      return `<tr${plan.id === s.recomendado ? ' class="recomendado"' : ''}>
        <td>${escapar(plan.nombre)}${etiqueta}</td>
        <td class="n">${numero(plan.infectados)}</td>
        <td class="n">${numero(plan.infectadosP5)}–${numero(plan.infectadosP95)}</td>
        <td class="n">${plan.salvados === null ? '—' : numero(plan.salvados)}</td>
        <td class="n">$${numero(plan.costo)}</td>
        <td class="n">${numero(plan.vacunas)}</td>
      </tr>`;
    })
    .join('');
  const graficas = (extras.graficas ?? [])
    .map(
      (g) =>
        `<figure><figcaption>${escapar(g.titulo)}</figcaption><div class="lienzo">${g.svg}</div>` +
        (g.leyenda ? `<div class="leyenda">${g.leyenda}</div>` : '') +
        '</figure>',
    )
    .join('');
  const operador = extras.operador?.trim();
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${nombreInforme(s)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font: 11pt/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif; color: #1b1f27; margin: 0; }
  header { border-bottom: 3px solid #f59e0b; padding-bottom: 8px; margin-bottom: 14px; }
  h1 { font-size: 20pt; margin: 0; letter-spacing: .06em; }
  h1 span { color: #d97706; }
  h2 { font-size: 12.5pt; margin: 18px 0 6px; color: #6d28d9; }
  .meta { color: #4b5563; font-size: 9.5pt; margin-top: 4px; }
  .destacado { background: #fff7ed; border: 1px solid #fdba74; border-radius: 8px; padding: 10px 12px; }
  .destacado p { margin: 2px 0; }
  ul { margin: 4px 0; padding-left: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th, td { border-bottom: 1px solid #e5e7eb; padding: 4px 6px; text-align: left; }
  th { background: #f3f4f6; }
  td.n, th.n { text-align: right; white-space: nowrap; }
  tr.recomendado td { background: #ecfdf5; }
  .alcalde { border-left: 4px solid #6d28d9; padding: 6px 10px; background: #f5f3ff; white-space: pre-line; }
  figure { margin: 14px 0 0; break-inside: avoid; }
  figcaption { font-weight: 600; margin-bottom: 4px; }
  .lienzo { background: #120b1f; border-radius: 8px; padding: 8px; }
  .lienzo svg { width: 100%; height: auto; display: block; }
  .leyenda { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 9pt; color: #e5e7eb; background: #120b1f; border-radius: 0 0 8px 8px; padding: 2px 12px 8px; }
  .lienzo:has(+ .leyenda) { border-radius: 8px 8px 0 0; }
  footer { margin-top: 18px; color: #6b7280; font-size: 8.5pt; border-top: 1px solid #e5e7eb; padding-top: 6px; }
</style></head><body>
<header>
  <h1>ZOMBIE <span>ZERO</span></h1>
  <div class="meta">Informe de simulación · Manta, Ecuador · ${new Date(s.momento).toLocaleString('es-EC')}</div>
  ${operador ? `<div class="meta">Descargado por: <b>${escapar(operador)}</b></div>` : ''}
</header>

<div class="destacado">
  <p><b>Plan recomendado:</b> ${escapar(recomendado?.nombre ?? 'ninguno')}</p>
  <p><b>Confianza:</b> ${confianza}</p>
  <p><b>Personas salvadas frente a no intervenir:</b> ${s.salvadosVsNinguna === null ? '—' : numero(s.salvadosVsNinguna)} de ${numero(s.nPersonas)} simuladas</p>
</div>

${extras.alcalde ? `<h2>Para el alcalde</h2><div class="alcalde">${escapar(extras.alcalde.trim())}</div>` : ''}

<h2>Configuración</h2>
<ul>
  <li>Origen del brote: ${escapar(capitalizar(s.inicio))}</li>
  <li>Población simulada: ${numero(s.nPersonas)} personas · ${s.dias} días · ${s.casosIniciales} casos iniciales</li>
  <li>Monte Carlo: ${s.repeticiones} repeticiones · semilla ${s.semilla}</li>
  <li>Plaga: R0 ${p.r0} · latencia ${p.diasLatencia} días · contagia ${p.diasInfeccioso} días · detección ${porcentaje(p.deteccion)}</li>
  <li>Recursos: presupuesto $${numero(r.presupuesto)} · ${numero(r.vacunasDisponibles)} vacunas a $${numero(r.costoVacuna)} · ${numero(r.vacunasPorDia)} por día desde el día ${r.diaInicio} · eficacia ${porcentaje(r.eficacia)}</li>
  <li>Cierres: ${r.diasCierre} días, cumplimiento ${porcentaje(r.cumplimientoCierre)} · mercado $${numero(r.costoCierreMercado)}/día · colegio $${numero(r.costoCierreColegio)}/día</li>
  <li>Imprevisto: ${corte}</li>
</ul>

<h2>Todos los planes</h2>
<table>
  <thead><tr><th>Plan (mismo presupuesto)</th><th class="n">Infectados (media)</th><th class="n">Rango p5–p95</th><th class="n">Salvados</th><th class="n">Costo</th><th class="n">Vacunas</th></tr></thead>
  <tbody>${planes}</tbody>
</table>

${graficas ? `<h2>Gráficas</h2>${graficas}` : ''}

<footer>
  Con la misma configuración y la misma semilla se obtiene el mismo resultado (id ${escapar(s.id)}).
  Población sintética: resultados de un modelo, no una predicción.
</footer>
</body></html>`;
}

export function nombreInforme(s: SimulacionGuardada): string {
  const fecha = s.momento.slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  return `zombie-zero-${fecha}-semilla${s.semilla}`;
}

// Copia una gráfica de la página con sus estilos calculados en línea.
export function capturarSvg(svg: SVGSVGElement): string {
  const copia = svg.cloneNode(true) as SVGSVGElement;
  const originales = [svg, ...svg.querySelectorAll('*')];
  const copias = [copia, ...copia.querySelectorAll('*')];
  originales.forEach((original, i) => {
    const calculado = getComputedStyle(original);
    const estilo = ESTILOS_SVG.map((prop) => `${prop}:${calculado.getPropertyValue(prop)}`).join(
      ';',
    );
    copias[i].setAttribute('style', estilo);
  });
  copia.removeAttribute('width');
  copia.removeAttribute('height');
  copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return copia.outerHTML;
}

// Copia una leyenda de la página: el texto de cada elemento con la muestra de su color.
export function capturarLeyenda(elementos: Element[]): string {
  return elementos
    .map((elemento) => {
      const muestra = elemento.querySelector('i, span');
      const texto = escapar(elemento.textContent?.replace(/\s+/g, ' ').trim() ?? '');
      if (!muestra) return `<span>${texto}</span>`;
      const c = getComputedStyle(muestra);
      const alto = Math.min(Math.max(parseFloat(c.height) || 3, 3), 12);
      const estilo =
        `display:inline-block;width:18px;height:${alto}px;margin-right:5px;vertical-align:middle;` +
        `background:${c.backgroundColor};border-radius:${c.borderRadius};` +
        `border-top:${c.borderTopWidth} ${c.borderTopStyle} ${c.borderTopColor}`;
      return `<span><span style="${estilo}"></span>${texto}</span>`;
    })
    .join('');
}

// Abre el diálogo de impresión del navegador con el informe («Guardar como PDF»).
export function imprimirInforme(html: string): void {
  const marco = document.createElement('iframe');
  marco.setAttribute('aria-hidden', 'true');
  marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(marco);
  const ventana = marco.contentWindow!;
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
  ventana.addEventListener('afterprint', () => marco.remove());
  setTimeout(() => {
    ventana.focus();
    ventana.print();
  }, 300);
}
