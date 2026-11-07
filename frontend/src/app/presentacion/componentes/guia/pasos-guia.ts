// Pasos del recorrido. Cada uno apunta a un elemento que ya existe en el panel;
// la guía solo lo resalta y lo explica, nunca lo pulsa ni cambia su valor.
export interface PasoGuia {
  titulo: string;
  texto: string;
  // Selectores a probar en orden: se resalta el primero que esté visible.
  // Sin selector (o si ninguno está a la vista) el paso se muestra centrado.
  objetivos: string[];
}

export const PASOS_GUIA: PasoGuia[] = [
  {
    titulo: 'Bienvenido al centro de control',
    texto:
      'Aquí simulas el brote zombie en una red de contactos de Manta y comparas planes de vacunación y cierres con el mismo presupuesto. Este recorrido solo explica la pantalla: no toca ningún control.',
    objetivos: [],
  },
  {
    titulo: 'Menú lateral',
    texto:
      'Cada enlace te lleva a una sección del panel. El botón ☰ / ✕ pliega o despliega este menú.',
    objetivos: ['#sidebar-principal'],
  },
  {
    titulo: 'Indicadores del brote',
    texto:
      'Personas salvadas frente al reparto al azar (con el veredicto), infectados sin intervenir, infectados con el plan recomendado y personas salvadas frente a no intervenir. Arriba se indica si las cifras son parciales (un día intermedio) o el resultado final.',
    objetivos: ['.metrics-grid'],
  },
  {
    titulo: 'Recomendación',
    texto:
      'El informe en lenguaje simple: qué plan aplicar, cuántas personas salva y qué tan sólido es frente al azar.',
    objetivos: ['app-informe'],
  },
  {
    titulo: 'Parámetros del brote',
    texto:
      'Elige un «Brote Sorpresa» o ajusta lo esencial: punto de origen, R0, presupuesto, vacunas y día de inicio. El resto está en «Más parámetros». Pasa el cursor sobre un campo para ver sus límites.',
    objetivos: ['#simulacion'],
  },
  {
    titulo: 'Ejecutar simulación',
    texto:
      'Este botón envía la configuración al motor y compara todos los planes. Se desactiva si hay valores fuera de rango o mientras simula.',
    objetivos: ['#simulacion .run-button', '#simulacion'],
  },
  {
    titulo: 'Mapa del brote por barrio',
    texto:
      'Tras simular, muestra qué porcentaje de cada barrio fue mordido día a día. Cambia de plan, reproduce la animación o mueve el deslizador de días.',
    objetivos: ['#mapa-brote'],
  },
  {
    titulo: 'Curva de contagios',
    texto:
      'Zombies activos cada día con cada plan: la media y la banda del percentil 5 al 95 de los brotes simulados.',
    objetivos: ['#resultados'],
  },
  {
    titulo: 'Opciones avanzadas',
    texto:
      'Para quien quiera profundizar: la comparativa de todos los planes, los estados SEIR, el modelo EDP de contraste, los resultados anteriores (con su PDF) y los datos reales. Están plegadas para que la pantalla principal sea simple.',
    objetivos: ['#boton-avanzado'],
  },
  {
    titulo: '¡Listo para contener el brote!',
    texto:
      'Configura los parámetros y pulsa «Ejecutar simulación». Puedes repetir este recorrido cuando quieras con el botón «Ver recorrido».',
    objetivos: [],
  },
];
