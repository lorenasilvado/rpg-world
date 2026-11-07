import { expose } from 'comlink'
import { generatorApi } from './generatorApi'

// Worker de geração (ADR 0001): expõe o núcleo pelo Comlink, fora da thread principal.
expose(generatorApi)
