import { expose } from 'comlink'
import { routerApi } from './routerApi'

// Worker de rota (F5, ADR 0001): o A* pelo terreno, fora da thread principal.
expose(routerApi)
