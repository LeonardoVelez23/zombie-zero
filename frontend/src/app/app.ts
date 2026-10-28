import { Component } from '@angular/core';

import { Panel } from './presentacion/paginas/panel/panel';

@Component({
  selector: 'app-root',
  imports: [Panel],
  template: '<app-panel />',
})
export class App {}
