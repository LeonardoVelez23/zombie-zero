import { Component, computed, input } from '@angular/core';

import { Calibracion as DatosCalibracion } from '../../../dominio/modelos/escenario';
import { numero } from '../../utilidades/formato';

const ANCHO = 760;
const ALTO = 200;
const MARGEN = { izq: 34, der: 8, arr: 10, aba: 22 };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const decimal = new Intl.NumberFormat('es-EC', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fecha = (iso: string): string => {
  const [, mes, dia] = iso.split('-').map(Number);
  return `${dia} ${MESES[mes - 1]}`;
};

// Casos semanales reales de COVID-19 en Manta (2020), la ventana ajustada y su curva exponencial.
@Component({
  selector: 'app-calibracion',
  templateUrl: './calibracion.html',
  styleUrl: './calibracion.css',
  host: { class: 'panel', id: 'calibracion' },
})
export class Calibracion {
  readonly calibracion = input.required<DatosCalibracion>();

  protected readonly ancho = ANCHO;
  protected readonly alto = ALTO;
  protected readonly margen = MARGEN;
  protected readonly numero = numero;
  protected readonly decimal = (v: number): string => decimal.format(v);

  private readonly escala = computed(() => {
    const { semanas } = this.calibracion();
    const maximo = Math.max(...semanas.map((s) => s.nuevos), 1);
    const paso = (ANCHO - MARGEN.izq - MARGEN.der) / semanas.length;
    const y = (v: number) => ALTO - MARGEN.aba - (v / maximo) * (ALTO - MARGEN.arr - MARGEN.aba);
    return { maximo, paso, y, primera: semanas[0].semana };
  });

  protected readonly barras = computed(() => {
    const { semanas, ventana } = this.calibracion();
    const { paso, y } = this.escala();
    return semanas.map((s, i) => ({
      x: MARGEN.izq + i * paso + 1,
      y: y(s.nuevos),
      ancho: Math.max(paso - 2, 1),
      alto: ALTO - MARGEN.aba - y(s.nuevos),
      enVentana: s.semana >= ventana[0] && s.semana <= ventana[1],
      titulo: `Semana al ${fecha(s.fin)}: ${numero(s.nuevos)} casos nuevos`,
    }));
  });

  protected readonly curva = computed(() => {
    const { ventana, ajuste } = this.calibracion();
    const { paso, y, primera } = this.escala();
    return ajuste
      .map((v, i) => {
        const x = MARGEN.izq + (ventana[0] + i - primera + 0.5) * paso;
        return `${i ? 'L' : 'M'}${x.toFixed(1)},${y(v).toFixed(1)}`;
      })
      .join(' ');
  });

  // Una marca por mes, en la primera semana que termina en él.
  protected readonly meses = computed(() => {
    const { paso } = this.escala();
    const vistos = new Set<number>();
    return this.calibracion().semanas.flatMap((s, i) => {
      const mes = Number(s.fin.split('-')[1]);
      if (vistos.has(mes)) return [];
      vistos.add(mes);
      return [{ x: MARGEN.izq + i * paso, texto: MESES[mes - 1] }];
    });
  });

  protected readonly maximo = computed(() => this.escala().maximo);

  protected readonly periodo = computed(() => {
    const { semanas, ventana } = this.calibracion();
    const inicio = semanas.find((s) => s.semana === ventana[0]);
    const fin = semanas.find((s) => s.semana === ventana[1]);
    return inicio && fin ? `${fecha(inicio.fin)} al ${fecha(fin.fin)} de 2020` : '';
  });

  protected readonly totalCasos = computed(() => this.calibracion().semanas.at(-1)?.acumulado ?? 0);
}
