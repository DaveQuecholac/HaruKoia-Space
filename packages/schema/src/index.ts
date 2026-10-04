export {
  type Checkpoint,
  type DocumentoReplicado,
  compararOrdenDeReplica,
  esPosteriorAlCheckpoint,
  traerDesdeCheckpoint,
} from './documento-replicado/documento-replicado.ts';

export {
  type DefinicionDeEsquema,
  type DocumentoCrudo,
  type Migracion,
  migrar,
  validarDefinicion,
} from './version-de-esquema/version-de-esquema.ts';
