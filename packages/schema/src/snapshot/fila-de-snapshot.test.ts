import { describe, expect, it } from 'vitest';

import {
  CAMPOS_DE_SNAPSHOT_H4,
  NOMBRE_DE_COLECCION_SNAPSHOTS,
  comoFilaDeSnapshot,
} from './fila-de-snapshot.ts';

describe('fila de snapshot', () => {
  const valida = {
    id: 'abcdefghjkmnpqrs',
    actualizadoEn: 100,
    borrado: false,
    estadoYjsBase64: 'AQID',
    tableroJson: '{"formato":1,"formas":[]}',
    formatoDeTablero: 1,
  };

  it('nombra la colección snapshots y lista solo campos H4', () => {
    expect(NOMBRE_DE_COLECCION_SNAPSHOTS).toBe('snapshots');
    expect(CAMPOS_DE_SNAPSHOT_H4).not.toContain('documents');
    expect(CAMPOS_DE_SNAPSHOT_H4).not.toContain('attachments');
  });

  it('acepta una fila mínima válida', () => {
    const resultado = comoFilaDeSnapshot(valida);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.fila.formatoDeTablero).toBe(1);
    expect(resultado.fila.tableroJson).toContain('"formato":1');
  });

  it('rechaza formato no entero o menor que 1', () => {
    expect(comoFilaDeSnapshot({ ...valida, formatoDeTablero: 0 })).toEqual({
      ok: false,
      causa: 'formato-invalido',
    });
    expect(comoFilaDeSnapshot({ ...valida, tableroJson: 1 })).toEqual({
      ok: false,
      causa: 'tablero-json-invalido',
    });
  });
});
