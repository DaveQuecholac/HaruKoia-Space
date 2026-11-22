/**
 * Quién puede escribir en la réplica: token de host de desarrollo (V6).
 * La sala del body debe coincidir con SALA_DEL_HOST cuando está configurada.
 */

export type CredencialDeHost = {
  readonly sala: string;
  readonly tokenDeHost: string;
};

export type ResultadoDeValidacion =
  | { readonly ok: true }
  | { readonly ok: false; readonly causa: 'sin-credencial' | 'host-no-autorizado' };

export function validarHost(
  presentado: { readonly sala?: string; readonly tokenDeHost?: string } | null | undefined,
  esperado: CredencialDeHost,
): ResultadoDeValidacion {
  if (!presentado?.sala || !presentado.tokenDeHost) {
    return { ok: false, causa: 'sin-credencial' };
  }
  if (presentado.sala !== esperado.sala) {
    return { ok: false, causa: 'host-no-autorizado' };
  }
  if (!igualEnTiempoConstante(presentado.tokenDeHost, esperado.tokenDeHost)) {
    return { ok: false, causa: 'host-no-autorizado' };
  }
  return { ok: true };
}

function igualEnTiempoConstante(a: string, b: string): boolean {
  const largo = Math.max(a.length, b.length);
  let distinto = a.length ^ b.length;
  for (let i = 0; i < largo; i += 1) {
    distinto |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return distinto === 0;
}
