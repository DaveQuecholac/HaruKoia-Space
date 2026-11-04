import { type IdentidadDeSala, generarIdentidadDeSala, generarTicket } from '@harukoia/domain';
import { crearRegistro } from '@harukoia/registro';
import { beforeEach, describe, expect, it } from 'vitest';

import { CADUCIDAD_DEL_EMPAREJAMIENTO, crearEmparejador } from './emparejamiento.ts';

let instante = 500_000;
let identidad: IdentidadDeSala;

/** El invitado es un handle cualquiera: aquí un objeto con nombre. */
type Invitado = { nombre: string };

function nuevoEmparejador(caducidad = CADUCIDAD_DEL_EMPAREJAMIENTO) {
  return crearEmparejador<Invitado>({
    registro: crearRegistro({ proceso: 'orquestador', destino: () => {} }),
    reloj: () => instante,
    caducidad,
  });
}

function avanzar(milisegundos: number) {
  instante += milisegundos;
}

beforeEach(() => {
  instante = 500_000;
  identidad = generarIdentidadDeSala();
});

describe('abrir un emparejamiento', () => {
  it('entrega conexión y ticket distintos cada vez', () => {
    const emparejador = nuevoEmparejador();
    const invitado = { nombre: 'ana' };

    const uno = emparejador.abrir({ sala: identidad.sala, canal: 'sesion', invitado });
    const otro = emparejador.abrir({ sala: identidad.sala, canal: 'sesion', invitado });

    expect(uno.conexion).not.toBe(otro.conexion);
    expect(uno.ticket).not.toBe(otro.ticket);
    expect(emparejador.pendientes()).toBe(2);
  });
});

describe('reclamar con el ticket', () => {
  it('empareja y entrega el invitado que esperaba', () => {
    const emparejador = nuevoEmparejador();
    const invitado = { nombre: 'ana' };
    const { conexion, ticket } = emparejador.abrir({
      sala: identidad.sala,
      canal: 'sesion',
      invitado,
    });

    const reclamo = emparejador.reclamar(conexion, ticket);

    expect(reclamo.ok).toBe(true);
    if (reclamo.ok) {
      expect(reclamo.pendiente.invitado).toBe(invitado);
      expect(reclamo.pendiente.sala).toBe(identidad.sala);
    }
  });

  it('es de un solo uso: el segundo intento se rechaza', () => {
    const emparejador = nuevoEmparejador();
    const { conexion, ticket } = emparejador.abrir({
      sala: identidad.sala,
      canal: 'sesion',
      invitado: { nombre: 'ana' },
    });

    expect(emparejador.reclamar(conexion, ticket).ok).toBe(true);
    const segundo = emparejador.reclamar(conexion, ticket);

    expect(segundo.ok).toBe(false);
    if (!segundo.ok) expect(segundo.causa).toBe('ticket-invalido');
    expect(emparejador.pendientes()).toBe(0);
  });

  it('un ticket de otro emparejamiento no sirve', () => {
    const emparejador = nuevoEmparejador();
    const mio = emparejador.abrir({
      sala: identidad.sala,
      canal: 'sesion',
      invitado: { nombre: 'ana' },
    });
    const ajeno = emparejador.abrir({
      sala: identidad.sala,
      canal: 'sesion',
      invitado: { nombre: 'beto' },
    });

    const reclamo = emparejador.reclamar(mio.conexion, ajeno.ticket);

    expect(reclamo.ok).toBe(false);
  });

  it('una conexión inventada y un ticket equivocado dan el mismo rechazo', () => {
    const emparejador = nuevoEmparejador();
    const { conexion } = emparejador.abrir({
      sala: identidad.sala,
      canal: 'sesion',
      invitado: { nombre: 'ana' },
    });

    const inventada = emparejador.reclamar(
      emparejador.abrir({
        sala: identidad.sala,
        canal: 'sesion',
        invitado: { nombre: 'x' },
      }).conexion,
      generarTicket(),
    );
    const equivocado = emparejador.reclamar(conexion, generarTicket());

    // Mismo rechazo a propósito: no se puede sondear qué conexiones existen.
    expect(inventada).toEqual(equivocado);
  });
});

describe('caducidad', () => {
  it('un ticket reclamado tarde se rechaza por expiración', () => {
    const emparejador = nuevoEmparejador();
    const { conexion, ticket } = emparejador.abrir({
      sala: identidad.sala,
      canal: 'sesion',
      invitado: { nombre: 'ana' },
    });

    avanzar(CADUCIDAD_DEL_EMPAREJAMIENTO + 1);
    const reclamo = emparejador.reclamar(conexion, ticket);

    expect(reclamo.ok).toBe(false);
    if (!reclamo.ok) expect(reclamo.causa).toBe('emparejamiento-expirado');
  });

  it('justo en el límite todavía empareja', () => {
    const emparejador = nuevoEmparejador();
    const { conexion, ticket } = emparejador.abrir({
      sala: identidad.sala,
      canal: 'sesion',
      invitado: { nombre: 'ana' },
    });

    avanzar(CADUCIDAD_DEL_EMPAREJAMIENTO);

    expect(emparejador.reclamar(conexion, ticket).ok).toBe(true);
  });

  it('barrer devuelve los invitados que se quedaron esperando', () => {
    const emparejador = nuevoEmparejador();
    const ana = { nombre: 'ana' };
    emparejador.abrir({ sala: identidad.sala, canal: 'sesion', invitado: ana });

    avanzar(CADUCIDAD_DEL_EMPAREJAMIENTO + 1);
    const caidos = emparejador.barrer();

    expect(caidos.map((caido) => caido.invitado)).toEqual([ana]);
    expect(emparejador.pendientes()).toBe(0);
  });

  it('barrer no toca a los que acaban de llegar', () => {
    const emparejador = nuevoEmparejador();
    emparejador.abrir({
      sala: identidad.sala,
      canal: 'sesion',
      invitado: { nombre: 'vieja' },
    });
    avanzar(CADUCIDAD_DEL_EMPAREJAMIENTO + 1);
    emparejador.abrir({
      sala: identidad.sala,
      canal: 'sesion',
      invitado: { nombre: 'nueva' },
    });

    expect(emparejador.barrer()).toHaveLength(1);
    expect(emparejador.pendientes()).toBe(1);
  });

  it('no deja huérfanos: tras barrer, barrer otra vez no devuelve nada', () => {
    const emparejador = nuevoEmparejador();
    for (let i = 0; i < 10; i += 1) {
      emparejador.abrir({
        sala: identidad.sala,
        canal: 'sesion',
        invitado: { nombre: `invitado-${i}` },
      });
    }

    avanzar(CADUCIDAD_DEL_EMPAREJAMIENTO + 1);
    expect(emparejador.barrer()).toHaveLength(10);
    expect(emparejador.barrer()).toEqual([]);
  });
});

describe('cancelar y agrupar por sala', () => {
  it('cancelar quita al invitado que se fue antes de emparejarse', () => {
    const emparejador = nuevoEmparejador();
    const { conexion, ticket } = emparejador.abrir({
      sala: identidad.sala,
      canal: 'sesion',
      invitado: { nombre: 'ana' },
    });

    expect(emparejador.cancelar(conexion)?.conexion).toBe(conexion);
    expect(emparejador.pendientes()).toBe(0);
    expect(emparejador.reclamar(conexion, ticket).ok).toBe(false);
  });

  it('cancelar algo que no existe no rompe', () => {
    const emparejador = nuevoEmparejador();
    const { conexion } = emparejador.abrir({
      sala: identidad.sala,
      canal: 'sesion',
      invitado: { nombre: 'ana' },
    });
    emparejador.cancelar(conexion);

    expect(emparejador.cancelar(conexion)).toBeUndefined();
  });

  it('agrupa los que esperan por una sala, para cancelarlos si se cierra', () => {
    const emparejador = nuevoEmparejador();
    const otra = generarIdentidadDeSala();
    emparejador.abrir({ sala: identidad.sala, canal: 'sesion', invitado: { nombre: 'ana' } });
    emparejador.abrir({ sala: identidad.sala, canal: 'sesion', invitado: { nombre: 'beto' } });
    emparejador.abrir({ sala: otra.sala, canal: 'sesion', invitado: { nombre: 'ajeno' } });

    expect(emparejador.deLaSala(identidad.sala)).toHaveLength(2);
    expect(emparejador.deLaSala(otra.sala)).toHaveLength(1);
  });
});

describe('el ticket no sale del emparejador', () => {
  it('lo que se entrega al emparejar no lo incluye', () => {
    const emparejador = nuevoEmparejador();
    const { conexion, ticket } = emparejador.abrir({
      sala: identidad.sala,
      canal: 'sesion',
      invitado: { nombre: 'ana' },
    });

    const reclamo = emparejador.reclamar(conexion, ticket);

    expect(reclamo.ok).toBe(true);
    if (reclamo.ok) expect(JSON.stringify(reclamo.pendiente)).not.toContain(ticket);
  });
});
