/**
 * Cuánto tarda un cambio en cruzar el relay hasta **el último** de los que
 * miran. Fijado en B9: lo que siente la sala, no el mejor caso.
 *
 * Cada participante **observa** su documento y marca el instante en que le
 * llegó el cambio. Encuestar cada tantos milisegundos mediría el encuestado,
 * no el relay.
 *
 * La medición **no reprueba** por ser alta: eso depende de la máquina. Solo
 * falla si a alguien no le llega dentro del tiempo máximo.
 */

import type * as Y from 'yjs';

/** El mapa que usa la medición. No lo toca ninguna otra prueba. */
const MAPA_DE_LA_MEDICION = 'latencia';

export type MedicionDeLatencia = {
  /** Milisegundos de cada ronda, en orden. */
  readonly rondas: readonly number[];
  readonly mediana: number;
  readonly peor: number;
};

/** Espera a que a este documento le llegue la clave, y devuelve cuándo llegó. */
function esperarLaLlegada(documento: Y.Doc, clave: string, limite: number): Promise<number> {
  const mapa = documento.getMap<unknown>(MAPA_DE_LA_MEDICION);

  return new Promise((resolver, rechazar) => {
    const mirar = (evento: Y.YMapEvent<unknown>) => {
      if (!evento.keysChanged.has(clave)) return;
      clearTimeout(rendirse);
      mapa.unobserve(mirar);
      resolver(performance.now());
    };

    const rendirse = setTimeout(() => {
      mapa.unobserve(mirar);
      rechazar(new Error(`un participante no recibió "${clave}" en ${limite} ms`));
    }, limite);

    mapa.observe(mirar);
  });
}

function mediana(valores: readonly number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  const alto = ordenados[medio] ?? 0;
  if (ordenados.length % 2 !== 0) return alto;
  return ((ordenados[medio - 1] ?? 0) + alto) / 2;
}

export async function medirLatencia(opciones: {
  /** Quien escribe. Si también está en `observadores`, no se cuenta a sí mismo. */
  readonly escritor: Y.Doc;
  readonly observadores: readonly Y.Doc[];
  readonly rondas: number;
  readonly espera?: number;
}): Promise<MedicionDeLatencia> {
  const { escritor, rondas, espera = 10_000 } = opciones;
  const observadores = opciones.observadores.filter((documento) => documento !== escritor);
  if (observadores.length === 0) throw new Error('la medición necesita al menos un observador');

  const medidas: number[] = [];

  for (let ronda = 0; ronda < rondas; ronda++) {
    const clave = `ronda-${ronda}`;
    const llegadas = observadores.map((documento) => esperarLaLlegada(documento, clave, espera));

    const salida = performance.now();
    escritor.getMap<unknown>(MAPA_DE_LA_MEDICION).set(clave, ronda);

    const tiempos = await Promise.all(llegadas);
    medidas.push(Math.max(...tiempos) - salida);
  }

  return { rondas: medidas, mediana: mediana(medidas), peor: Math.max(...medidas) };
}

/** Una línea para pegar en el README de la rama. */
export function resumenDeLatencia(medicion: MedicionDeLatencia, participantes: number): string {
  const ms = (valor: number) => `${valor.toFixed(1)} ms`;
  return `latencia con ${participantes} participantes, ${medicion.rondas.length} rondas: mediana ${ms(medicion.mediana)}, peor ${ms(medicion.peor)}`;
}
