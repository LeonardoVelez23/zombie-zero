import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  ConfiguracionSimulacion,
  Escenario,
  Parametros,
  Rango,
} from '../../../dominio/modelos/escenario';
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
// Las secciones "avanzadas" quedan plegadas para que el formulario no abrume a primera vista.
interface Seccion {
  titulo: string;
  campos: Campo[];
  avanzada?: boolean;
  // La semilla va junto a las repeticiones: las dos definen qué brotes se simulan.
  conRepeticiones?: boolean;
}

const SECCIONES: Seccion[] = [
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
    titulo: 'Monte Carlo',
    conRepeticiones: true,
    campos: [
      { grupo: 'escenario', nombre: 'semilla', etiqueta: 'Semilla', unidad: 'SEED', paso: 1 },
    ],
  },
  {
    titulo: 'Escenario',
    avanzada: true,
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
    ],
  },
  {
    // Imprevisto en vivo: se bloquea la vía y las vacunas dejan de llegar unos días.
    titulo: 'Imprevisto: corte de vacunas',
    avanzada: true,
    campos: [
      { grupo: 'recursos', nombre: 'corteDesde', etiqueta: 'Desde el día', unidad: 'DÍA', paso: 1 },
      { grupo: 'recursos', nombre: 'corteDias', etiqueta: 'Durante', unidad: 'DÍAS', paso: 1 },
    ],
  },
];

const CAMPOS = SECCIONES.flatMap((s) => s.campos);
const AVANZADOS = new Set(
  SECCIONES.filter((s) => s.avanzada).flatMap((s) => s.campos.map((c) => c.nombre)),
);

interface Sorpresa {
  nombre: string;
  detalle: string;
  // Valores del formulario que cambia, calculados a partir del escenario por defecto.
  valores: (porDefecto: Escenario) => Record<string, number | string>;
}

// Los Brotes Sorpresa típicos del jurado, a un clic. Se acumulan: "R0 doble" + "Mercado" aplica ambos.
const SORPRESAS: Sorpresa[] = [
  {
    nombre: 'R0 doble',
    detalle: 'El doble de contagiosa',
    valores: (d) => ({ r0: d.plaga.r0 * 2 }),
  },
  {
    nombre: 'Mitad de vacunas',
    detalle: 'Llega solo la mitad del stock',
    valores: (d) => ({ vacunasDisponibles: Math.round(d.recursos.vacunasDisponibles / 2) }),
  },
  {
    nombre: 'Mercado',
    detalle: 'El brote empieza en el mercado',
    valores: () => ({ inicio: 'mercado' }),
  },
  {
    nombre: 'Variante',
    detalle: 'La vacuna cubre a medias',
    valores: (d) => ({ eficacia: d.recursos.eficacia / 2 }),
  },
  {
    nombre: 'Corte de vacunas',
    detalle: '30 días sin entregas desde que se empieza a actuar',
    valores: (d) => ({ corteDesde: d.recursos.diaInicio, corteDias: 30 }),
  },
];

@Component({
  selector: 'app-controles',
  imports: [NgTemplateOutlet, ReactiveFormsModule],
  templateUrl: './controles.html',
  styleUrl: './controles.css',
  host: { class: 'panel', id: 'simulacion' },
})
export class Controles implements OnInit {
  readonly parametros = input.required<Parametros>();
  readonly cargando = input(false);
  readonly ejecutar = output<ConfiguracionSimulacion>();

  protected readonly principales = SECCIONES.filter((s) => !s.avanzada);
  protected readonly avanzadas = SECCIONES.filter((s) => s.avanzada);
  // «Más parámetros» desplegado; se abre solo si un Brote Sorpresa cambia alguno de esos campos.
  protected readonly verAvanzado = signal(false);
  // Además de los Brotes Sorpresa, el escenario con el R efectivo medido en Manta (datos reales de 2020).
  protected readonly sorpresas = computed<Sorpresa[]>(() => {
    const calibracion = this.parametros().calibracion;
    if (!calibracion) return SORPRESAS;
    return [
      ...SORPRESAS,
      {
        nombre: 'R de Manta 2020',
        detalle: `R efectivo de la COVID-19 en Manta con medidas (datos reales): ${calibracion.rEfectivo}`,
        valores: () => ({ r0: calibracion.rEfectivo }),
      },
    ];
  });
  protected readonly etiquetaInicio = (inicio: string): string =>
    ETIQUETAS_INICIO[inicio] ?? capitalizar(inicio);
  protected formulario = new FormGroup<Record<string, FormControl>>({});

  ngOnInit(): void {
    const { limites, repeticiones } = this.parametros();
    const controles: Record<string, FormControl> = {};
    for (const [nombre, valor] of Object.entries(this.valoresPorDefecto())) {
      const campo = CAMPOS.find((c) => c.nombre === nombre);
      const limite = campo
        ? limites[campo.grupo][nombre]
        : nombre === 'repeticiones'
          ? repeticiones.limites
          : null;
      controles[nombre] = new FormControl(valor, {
        nonNullable: true,
        validators: limite ? rango(limite) : [],
      });
    }
    this.formulario = new FormGroup(controles);
  }

  protected aplicarSorpresa(sorpresa: Sorpresa): void {
    const valores = sorpresa.valores(this.parametros().porDefecto);
    if (Object.keys(valores).some((nombre) => AVANZADOS.has(nombre))) this.verAvanzado.set(true);
    this.formulario.patchValue(valores);
    this.enviar();
  }

  // Pone en el formulario una configuración ya simulada (por ejemplo, del historial) sin simular.
  cargar(configuracion: ConfiguracionSimulacion): void {
    const escenario = configuracion.escenario ?? {};
    const grupos: Record<Grupo, object | undefined> = {
      escenario,
      plaga: escenario.plaga,
      recursos: escenario.recursos,
    };
    const valores: Record<string, number | string> = {};
    if (configuracion.repeticiones !== undefined)
      valores['repeticiones'] = configuracion.repeticiones;
    if (escenario.inicio !== undefined) valores['inicio'] = escenario.inicio;
    for (const campo of CAMPOS) {
      const valor = (grupos[campo.grupo] as Record<string, number> | undefined)?.[campo.nombre];
      if (valor !== undefined) valores[campo.nombre] = valor;
    }
    const porDefecto = this.valoresPorDefecto();
    if (Object.keys(valores).some((n) => AVANZADOS.has(n) && valores[n] !== porDefecto[n])) {
      this.verAvanzado.set(true);
    }
    this.formulario.patchValue(valores);
  }

  protected restablecer(): void {
    this.formulario.setValue(this.valoresPorDefecto());
    this.enviar();
  }

  // Una sorpresa está activa mientras el formulario tenga todos sus valores.
  protected activa(sorpresa: Sorpresa): boolean {
    const actuales = this.formulario.getRawValue();
    return Object.entries(sorpresa.valores(this.parametros().porDefecto)).every(
      ([nombre, valor]) => actuales[nombre] === valor,
    );
  }

  private valoresPorDefecto(): Record<string, number | string> {
    const { porDefecto, repeticiones } = this.parametros();
    const grupos: Record<Grupo, object> = {
      escenario: porDefecto,
      plaga: porDefecto.plaga,
      recursos: porDefecto.recursos,
    };
    const valores: Record<string, number | string> = {
      inicio: porDefecto.inicio,
      repeticiones: repeticiones.porDefecto,
    };
    for (const campo of CAMPOS) {
      valores[campo.nombre] = (grupos[campo.grupo] as Record<string, number>)[campo.nombre];
    }
    return valores;
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
