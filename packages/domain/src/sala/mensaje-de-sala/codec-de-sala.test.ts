import { describe, expect, it } from 'vitest';

import { generarIdentificadorDeCommit } from '../../commit/identificador-de-commit/identificador-de-commit.ts';
import { generarIdentidadDeSala } from '../identidad-de-sala/identidad-de-sala.ts';
import { interpretarMensajeDeSala, serializarMensajeDeSala } from './codec-de-sala.ts';
import type { MensajeDeSala } from './mensaje-de-sala.ts';

describe('codec de mensajes de sala', () => {
  it('cada mensaje sobrevive la ida y vuelta', () => {
    const mensajes: MensajeDeSala[] = [
      { tipo: 'pedir-accion', accion: 'cambiar-invitacion' },
      { tipo: 'pedir-accion', accion: 'commitear', mensaje: 'primera versión' },
      {
        tipo: 'pedir-accion',
        accion: 'hacer-checkout',
        id: generarIdentificadorDeCommit(),
      },
      {
        tipo: 'pedir-accion',
        accion: 'publicar',
        id: generarIdentificadorDeCommit(),
      },
      {
        tipo: 'pedir-accion',
        accion: 'reintentar-publicacion',
        id: generarIdentificadorDeCommit(),
      },
      { tipo: 'tu-rol', rol: 'espectador' },
      { tipo: 'accion-rechazada', accion: 'cambiar-invitacion', causa: 'rol-insuficiente' },
      { tipo: 'accion-rechazada', accion: 'commitear', causa: 'commit-fallido' },
      { tipo: 'accion-rechazada', accion: 'hacer-checkout', causa: 'commit-inexistente' },
      { tipo: 'accion-rechazada', accion: 'publicar', causa: 'ya-publicado' },
      { tipo: 'invitacion-cambiada', tokenDeInvitacion: generarIdentidadDeSala().tokenDeInvitacion },
      {
        tipo: 'historial',
        tip: null,
        commits: [
          {
            id: generarIdentificadorDeCommit(),
            mensaje: 'primera',
            autor: 'Marco',
            creadoEn: 1,
            padre: null,
          },
        ],
        estadosDePush: [],
      },
      {
        tipo: 'commit-guardado',
        id: generarIdentificadorDeCommit(),
        mensaje: 'ok',
        autor: 'Marco',
        creadoEn: 1,
        padre: null,
      },
      { tipo: 'checkout-hecho', id: generarIdentificadorDeCommit() },
      {
        tipo: 'estado-de-push',
        documento: 'p2docaaaaaaaaaaaa',
        commit: generarIdentificadorDeCommit(),
        estadoTipo: 'en-proceso',
        causa: null,
        marca: null,
      },
      {
        tipo: 'estado-de-push',
        documento: 'p2docbbbbbbbbbbbb',
        commit: generarIdentificadorDeCommit(),
        estadoTipo: 'publicado',
        causa: null,
        marca: 100,
      },
      {
        tipo: 'estado-de-push',
        documento: 'p2doccccccccccccccccc',
        commit: generarIdentificadorDeCommit(),
        estadoTipo: 'fallido',
        causa: 'sin-remoto',
        marca: 200,
      },
    ];

    for (const mensaje of mensajes) {
      expect(interpretarMensajeDeSala(serializarMensajeDeSala(mensaje))).toEqual({ ok: true, mensaje });
    }
  });

  it('un rol que se cuela en la petición no es parte del contrato y se ignora', () => {
    const leido = interpretarMensajeDeSala(
      JSON.stringify({ tipo: 'pedir-accion', accion: 'cambiar-invitacion', rol: 'host' }),
    );

    expect(leido).toEqual({ ok: true, mensaje: { tipo: 'pedir-accion', accion: 'cambiar-invitacion' } });
  });

  it('rechaza lo que no está en el contrato', () => {
    expect(interpretarMensajeDeSala('{no json').ok).toBe(false);
    expect(interpretarMensajeDeSala(JSON.stringify({ tipo: 'bailar' })).ok).toBe(false);
    expect(interpretarMensajeDeSala(JSON.stringify({ tipo: 'pedir-accion', accion: 'borrar-todo' })).ok).toBe(false);
    expect(interpretarMensajeDeSala(JSON.stringify({ tipo: 'tu-rol', rol: 'admin' })).ok).toBe(false);
  });
});
