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
      'Población simulada, infectados sin intervenir, infectados con el plan recomendado y personas salvadas. Se llenan al ejecutar una simulación.',
    objetivos: ['.metrics-grid'],
  },
  {
    titulo: 'Parámetros del brote',
    texto:
      'Elige un «Brote Sorpresa» o ajusta a mano el punto de origen, el escenario, la plaga, los recursos y las repeticiones Monte Carlo. Pasa el cursor sobre un campo para ver sus límites.',
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
    titulo: 'Zombies activos por día',
    texto:
      'Curva de cada plan: la línea es la media de los brotes simulados y la banda cubre del percentil 5 al 95.',
    objetivos: ['#resultados'],
  },
  {
    titulo: 'Estados SEIR',
    texto:
      'Cuántas personas están sanas, mordidas, zombies o exorcizadas cada día. Elige el plan y el día que quieres ver.',
    objetivos: ['#estados'],
  },
  {
    titulo: 'Comparativa de planes',
    texto:
      'Todos los planes con su costo, infectados, personas salvadas, vacunas y cuántas veces ganan al reparto al azar. El recomendado lleva su insignia.',
    objetivos: ['#estrategias'],
  },
  {
    titulo: 'Recomendación',
    texto:
      'El informe en lenguaje simple: qué plan aplicar, cuántas personas salva y qué tan sólido es frente al azar.',
    objetivos: ['app-informe'],
  },
  {
    titulo: 'Modelo de red o EDP',
    texto:
      'Arriba del mapa puedes cambiar al modelo EDP: la difusión continua sobre el mapa real con el mismo escenario. Debajo aparece la comparación de los dos modelos; la recomendación sale del modelo de red.',
    objetivos: ['#selector-modelo'],
  },
  {
    titulo: '¡Listo para contener el brote!',
    texto:
      'Configura los parámetros y pulsa «Ejecutar simulación». Puedes repetir este recorrido cuando quieras con el botón «Ver recorrido».',
    objetivos: [],
  },
];
