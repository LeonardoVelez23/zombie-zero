import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { CurvaZombies, PlanResultado, SimulacionRespuesta } from '../../modelos/parametros';

interface GraficaCalculada {
  pathMedia: string;
  pathBandaP5P95: string;
  pathAreaMedia: string;
  ejeX: { x: number; label: string }[];
  ejeY: { y: number; label: string }[];
}

@Component({
  selector: 'app-grafica-epidemiologica',
  imports: [CommonModule],
  templateUrl: './grafica-epidemiologica.html',
  styles: [':host { display: flex; min-width: 0; } .chart-panel { width: 100%; }'],
})
export class GraficaEpidemiologicaComponent {
  readonly respuesta = input<SimulacionRespuesta | null>(null);
  readonly plan = input<PlanResultado | null>(null);
  readonly dias = input(180);

  protected readonly graficaCalculada = computed(() =>
    this.calcularGrafica(this.plan()?.curva_zombies, this.respuesta()?.escenario.dias ?? this.dias())
  );

  private calcularGrafica(
    curva: CurvaZombies | null | undefined,
    diasTotales: number
  ): GraficaCalculada | null {
    if (!curva || curva.media.length === 0) return null;

    const n = curva.media.length;
    const p95Max = Math.max(...curva.p95, ...curva.media, 10);

    let escalaY = 10;
    if (p95Max <= 25) escalaY = 25;
    else if (p95Max <= 50) escalaY = 50;
    else if (p95Max <= 100) escalaY = 100;
    else if (p95Max <= 200) escalaY = 200;
    else if (p95Max <= 300) escalaY = 300;
    else if (p95Max <= 500) escalaY = 500;
    else if (p95Max <= 1000) escalaY = 1000;
    else if (p95Max <= 2500) escalaY = 2500;
    else if (p95Max <= 5000) escalaY = 5000;
    else if (p95Max <= 10000) escalaY = 10000;
    else escalaY = Math.ceil(p95Max / 1000) * 1000;

    const xMin = 55;
    const xMax = 675;
    const xSpan = xMax - xMin;
    const yBottom = 250;
    const yHeight = 220;
    const getX = (i: number): number =>
      Math.round((xMin + (i / (n - 1)) * xSpan) * 10) / 10;
    const getY = (value: number): number => {
      const clamped = Math.max(0, Math.min(escalaY, value));
      return Math.round((yBottom - (clamped / escalaY) * yHeight) * 10) / 10;
    };

    const ptsMedia = curva.media.map((value, i) => `${getX(i)} ${getY(value)}`);
    const pathMedia = `M ${ptsMedia.join(' L ')}`;
    const pathAreaMedia = `M ${xMin} ${yBottom} L ${ptsMedia.join(' L ')} L ${xMax} ${yBottom} Z`;
    const ptsP95 = curva.p95.map((value, i) => `${getX(i)} ${getY(value)}`);
    const ptsP5Rev = [...curva.p5].map((value, i) => `${getX(i)} ${getY(value)}`).reverse();
    const pathBandaP5P95 = `M ${ptsP95[0]} L ${ptsP95.slice(1).join(' L ')} L ${ptsP5Rev.join(' L ')} Z`;

    const formatY = (value: number): string =>
      value >= 1000
        ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
        : Math.round(value).toString();
    const ejeY = [
      { y: 34, label: formatY(escalaY) },
      { y: 89, label: formatY(escalaY * 0.75) },
      { y: 144, label: formatY(escalaY * 0.5) },
      { y: 199, label: formatY(escalaY * 0.25) },
      { y: 254, label: '0' },
    ];

    const totalDias = diasTotales > 0 ? diasTotales : n - 1;
    const ejeX = [
      { x: 55, label: 'Día 0' },
      { x: 245, label: `Día ${Math.round(totalDias / 3)}` },
      { x: 440, label: `Día ${Math.round((2 * totalDias) / 3)}` },
      { x: 675, label: `Día ${totalDias}` },
    ];

    return { pathMedia, pathBandaP5P95, pathAreaMedia, ejeX, ejeY };
  }
}
