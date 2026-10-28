import { Component, OnInit, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ConfiguracionSimulacion, Parametros, Rango } from '../../../dominio/modelos/escenario';
import { capitalizar } from '../../utilidades/formato';

type Grupo = 'escenario' | 'plaga' | 'recursos';

// Los barrios se muestran con su nombre; estos puntos de origen necesitan una explicación.
const ETIQUETAS_INICIO: Record<string, string> = {
  aeropuerto: 'Aeropuerto (avión con zombies)',
  aleatorio: 'Al azar en la ciudad',
  mercado: 'Mercado',
  colegio: 'Colegio',
};

interface Campo {
  grupo: Grupo;
  nombre: string;
  etiqueta: string;
  unidad: string;
  paso: number;
}

// Solo los parámetros que más cambian el resultado; el resto toma el valor por defecto.
const SECCIONES: { titulo: string; campos: Campo[] }[] = [
  {
    titulo: 'Escenario',
    campos: [
      {
        grupo: 'escenario',
        nombre: 'nPersonas',
        etiqueta: 'Población',
        unidad: 'PERSONAS',
        paso: 1000,
      },
      { grupo: 'escenario', nombre: 'dias', etiqueta: 'Duración', unidad: 'DÍAS', paso: 1 },
      {
        grupo: 'escenario',
        nombre: 'casosIniciales',
        etiqueta: 'Casos iniciales',
        unidad: 'ZOMBIES',
        paso: 1,
      },
      { grupo: 'escenario', nombre: 'semilla', etiqueta: 'Semilla', unidad: 'SEED', paso: 1 },
    ],
  },
  {
    titulo: 'Plaga',
    campos: [
      { grupo: 'plaga', nombre: 'r0', etiqueta: 'R0', unidad: 'CONTAGIOS', paso: 0.1 },
      { grupo: 'plaga', nombre: 'deteccion', etiqueta: 'Detección', unidad: '0 – 1', paso: 0.05 },
    ],
  },
  {
    titulo: 'Recursos',
    campos: [
      {
        grupo: 'recursos',
        nombre: 'presupuesto',
        etiqueta: 'Presupuesto',
        unidad: 'USD',
        paso: 1000,
      },
      {
        grupo: 'recursos',
        nombre: 'vacunasDisponibles',
        etiqueta: 'Vacunas',
        unidad: 'DOSIS',
        paso: 100,
      },
      { grupo: 'recursos', nombre: 'eficacia', etiqueta: 'Eficacia', unidad: '0 – 1', paso: 0.05 },
      // Cuándo se empieza a actuar y a qué ritmo llegan las vacunas: lo que más cambia el resultado.
      { grupo: 'recursos', nombre: 'diaInicio', etiqueta: 'Día de inicio', unidad: 'DÍA', paso: 1 },
      {
        grupo: 'recursos',
        nombre: 'vacunasPorDia',
        etiqueta: 'Vacunas por día',
        unidad: 'DOSIS',
        paso: 10,
      },
    ],
  },
  {
    // Imprevisto en vivo: se bloquea la vía y las vacunas dejan de llegar unos días.
    titulo: 'Imprevisto: corte de vacunas',
    campos: [
      { grupo: 'recursos', nombre: 'corteDesde', etiqueta: 'Desde el día', unidad: 'DÍA', paso: 1 },
      { grupo: 'recursos', nombre: 'corteDias', etiqueta: 'Durante', unidad: 'DÍAS', paso: 1 },
    ],
  },
];

const CAMPOS = SECCIONES.flatMap((s) => s.campos);

@Component({
  selector: 'app-controles',
  imports: [ReactiveFormsModule],
  templateUrl: './controles.html',
  styleUrl: './controles.css',
  host: { class: 'panel', id: 'simulacion' },
})
export class Controles implements OnInit {
  readonly parametros = input.required<Parametros>();
  readonly cargando = input(false);
  readonly ejecutar = output<ConfiguracionSimulacion>();

  protected readonly secciones = SECCIONES;
  protected readonly etiquetaInicio = (inicio: string): string =>
    ETIQUETAS_INICIO[inicio] ?? capitalizar(inicio);
  protected formulario = new FormGroup<Record<string, FormControl>>({});

  ngOnInit(): void {
    const { porDefecto, limites, repeticiones } = this.parametros();
    const valores: Record<Grupo, object> = {
      escenario: porDefecto,
      plaga: porDefecto.plaga,
      recursos: porDefecto.recursos,
    };

    const controles: Record<string, FormControl> = {
      inicio: new FormControl(porDefecto.inicio, { nonNullable: true }),
      repeticiones: new FormControl(repeticiones.porDefecto, {
        nonNullable: true,
        validators: rango(repeticiones.limites),
      }),
    };
    for (const campo of CAMPOS) {
      const valor = (valores[campo.grupo] as Record<string, number>)[campo.nombre];
      controles[campo.nombre] = new FormControl(valor, {
        nonNullable: true,
        validators: rango(limites[campo.grupo][campo.nombre]),
      });
    }
    this.formulario = new FormGroup(controles);
  }

  protected limites(campo: Campo): Rango {
    return this.parametros().limites[campo.grupo][campo.nombre];
  }

  protected enviar(): void {
    if (this.formulario.invalid) return;
    const valores = this.formulario.getRawValue();
    const grupo = (g: Grupo) =>
      Object.fromEntries(
        CAMPOS.filter((c) => c.grupo === g).map((c) => [c.nombre, valores[c.nombre]]),
      );
    this.ejecutar.emit({
      repeticiones: valores['repeticiones'],
      escenario: {
        ...grupo('escenario'),
        inicio: valores['inicio'],
        plaga: grupo('plaga'),
        recursos: grupo('recursos'),
      },
    });
  }
}

function rango([minimo, maximo]: Rango) {
  return [Validators.required, Validators.min(minimo), Validators.max(maximo)];
}
