import { Component, inject, signal, OnInit } from '@angular/core';
import { Api } from './servicios/api';
import { ParametrosRespuesta } from './modelos/parametros';

@Component({
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected readonly title = signal('zombie-zero-ui');

  private readonly api = inject(Api);

  protected readonly estadoConexion = signal<'conectando' | 'online' | 'offline'>('conectando');
  protected readonly cargandoParametros = signal<boolean>(false);
  protected readonly parametros = signal<ParametrosRespuesta | null>(null);
  protected readonly errorCarga = signal<string | null>(null);

  ngOnInit(): void {
    this.verificarYcargar();
  }

  protected reintentar(): void {
    this.verificarYcargar();
  }

  private verificarYcargar(): void {
    this.estadoConexion.set('conectando');
    this.errorCarga.set(null);

    this.api.comprobarSalud().subscribe({
      next: () => {
        this.estadoConexion.set('online');
        this.cargarParametros();
      },
      error: (error) => {
        console.error('Error al conectar con la API:', error);
        this.estadoConexion.set('offline');
        this.errorCarga.set('No se pudo establecer conexión con el backend en http://localhost:8000.');
      },
    });
  }

  private cargarParametros(): void {
    this.cargandoParametros.set(true);
    this.api.obtenerParametros().subscribe({
      next: (datos) => {
        this.parametros.set(datos);
        this.cargandoParametros.set(false);
        this.errorCarga.set(null);
      },
      error: (error) => {
        console.error('Error al cargar parámetros:', error);
        this.cargandoParametros.set(false);
        this.errorCarga.set('La API está disponible, pero no se pudieron obtener los parámetros.');
      },
    });
  }
}
