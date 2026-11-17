# Plan de acción — H3 La sala sobrevive

Rama: `dev/persistencia-sala`.  
Análisis: [analisis-h3-persistencia-sala.md](./analisis-h3-persistencia-sala.md).

## Reglas de trabajo

1. **Un paso → parar → verificar → pruebas de ese paso.** No se encadenan pasos de código sin checkpoint.
2. Ningún paso se da por terminado solo porque compila.
3. E1, E2, E3 y E4 se confirman en el chat **antes** del paso que las lista. Si el diseño no define el resto, se detiene y se actualiza el análisis.
4. Sin fallback: disco ilegible no crea otra sala; no hay una segunda lectura «por si acaso».
5. Esta rama no implementa H4–H7, no le da memoria al orquestador y no mezcla el SQLite del documento con PowerSync.
6. Dependencias solo con el gestor del repo (`pnpm add` en `apps/host`). No se editan a mano `package.json` ni el lockfile.

## Mapa

```text
P0  Rama y esta carpeta
        │
        ▼  E1 y E2 cerradas el 2026-11-12
D1  Documento Yjs en SQLite del host
        │
        ▼  checkpoint: E1 confirmada (si D1 no la gastó entera)
D2  Identidad durable, escrita antes de registrar
        │
        ▼
D3  Arranque que restaura la misma sala
        │
        ├── D4  SIGTERM sigue siendo cierre definitivo, y vacía el guardado
        │
        ▼  checkpoint: E4 confirmada
D5  Reconexión sin recargar
D7  Estados visibles (puede no tocar código)
        │
        ▼
D6  Fusión de quien trabajó sin red
        │
        ▼  E3 cerrada el 2026-11-12: el estado codificado cubre H3-T3
D8  Compactación (sin código; al commitear es H4)
        │
        ▼
D9  Resistencia y definition of done
```

D4 puede hacerse en cuanto D1 y D2 existen. D5 y D7 esperan E4. E3 cerró el 2026-11-12: el estado codificado ya es la compactación de H3, y D8 no tiene código.

---

## P0 — Rama y documentación

**Objetivo.** Dejar H3 escrita antes de código de producto.

**Hecho cuando.**

- `git branch --show-current` → `dev/persistencia-sala`
- Existen este plan, el análisis y el README

**Prohibido en P0:** `Write` / `StrReplace` en `apps/**` o `packages/**`.

---

## D1 — El documento queda en disco

**Objetivo.** El `Y.Doc` de la sala se guarda como binario en SQLite y se vuelve a cargar por el nombre de la sala. H3-T1.

**Depende de.** E1 y E2, cerradas en el análisis el 2026-11-12. El aviso de la ventana perdida queda para D7.

**Cómo, ya fijado por la documentación de Hocuspocus 4.** Extensión `@hocuspocus/extension-sqlite` con `better-sqlite3`, en el `Hocuspocus` que ya construye `abrirSalaEnVivo`. El `database` es una ruta de archivo, no `:memory:`. El documento se guarda como `Uint8Array`. No se añade un segundo servidor de Hocuspocus ni se abre un puerto.

**Archivos esperados.** `apps/host` (dependencias) y `apps/host/src/sala/`. La prueba vive junto a la sala. No un paquete nuevo de «persistencia» al lado del dominio.

**Pruebas.**

- Con un directorio temporal: se escribe un mapa, se cierra la sala, se abre otra con el mismo nombre y el mapa está.
- El estado leído no contiene `tokenDeHost`, `tokenDeInvitacion` ni `tokenDeWebDelHost` (F6).
- Un `documentName` distinto de la sala se sigue rechazando.
- La conexión directa del host sigue abierta (F16).

**Errores que este paso deja resueltos o explícitos.** F1 según el texto de E2. F12: si guardar lanza, el log del host tiene la causa y el proceso no cambia de sala.

**Hecho cuando.** La prueba del directorio temporal pasa y `pnpm` typecheck del host pasa. **Parar.** No seguir a D2 en el mismo cambio salvo que el chat lo haya pedido junto.

---

## D2 — La identidad es la misma sala

**Objetivo.** Los cuatro campos de `IdentidadDeSala` sobreviven, y la rotación del token de invitación también. Sin esto, D1 restaura un documento que nadie puede volver a abrir con el link que ya compartió. H3-T2 en la parte de identidad.

**Depende de.** E1, cerrada. El almacén es el keyring del sistema (`@napi-rs/keyring`, servicio `iokoia.harukoia`), no un archivo. «Ilegible» en las pruebas es una entrada del keyring que no es la identidad.

**Archivos esperados.** El dueño es la sala en el host, al lado de `apps/host/src/sala/` o de la invitación, según el almacén que E1 haya elegido. `generarIdentidadDeSala()` se queda para el primer arranque. No se añade un mapa de identidades viejas.

**Orden.** Escribir la identidad y después registrar en el orquestador (F4). Rotar la invitación escribe el token nuevo antes de responder al éxito de la acción (F5).

**Pruebas.**

- Segunda lectura de la misma cuenta del keyring: mismos cuatro valores.
- Rotar y volver a leer: solo cambió `tokenDeInvitacion`.
- Entrada ilegible: no hay identidad nueva. No se llama a `generarIdentidadDeSala()` en ese camino (F3, F7, F18).
- Los tokens no aparecen en el binario del documento (el criterio de D1; el almacén de la identidad es otro).

**Hecho cuando.** Esas pruebas pasan. **Parar.**

---

## D3 — Arrancar es volver a la sala

**Objetivo.** Un proceso host real, matado y levantado otra vez con el mismo directorio, publica la misma sala y el mismo documento. Une D1 y D2 con `main.ts`.

**Depende de.** D1 y D2.

**Pruebas.** En `packages/pruebas-entre-procesos`, junto a la resistencia que ya levanta `apps/host/src/main.ts`:

- Dos invitados se escriben un valor.
- SIGKILL al host (F1, con la ventana ya acordada: el valor se escribe y se espera a que el guardado haya ocurrido, para no mezclar este caso con la ventana).
- Se levanta otro host con el mismo directorio y el mismo `ORQUESTADOR_URL`.
- `GET /invitacion` devuelve la misma sala y el mismo token.
- El invitado que no se reconstruyó —el mismo objeto— observa el valor.
- La lista de presencia, justo después de cargar y antes de que nadie entre, no conserva los nombres anteriores (F8).

**Hecho cuando.** Esa prueba pasa y las de H1/H2 que levantan el host siguen pasando. El arranque de pruebas tiene que recibir un directorio temporal; si no, los hosts de prueba compartirían disco. **Parar.**

---

## D4 — Apagado limpio y muerte súbita siguen siendo distintos

**Objetivo.** H3 no convierte el SIGTERM en «espera y reintenta». H3-T4 no borra el cierre definitivo.

**Depende de.** D1 y D2.

**Comportamiento que ya está y tiene que seguir.**

| Señal | Invitado | Disco |
|-------|----------|-------|
| SIGTERM | Recibe `host-cerro-la-sala` y no reintenta (F2, F14) | El pendiente se vació en `sala.cerrar()` |
| SIGKILL | No recibe cierre de sala (la prueba actual) | Queda el último guardado |

**Pruebas.** Las dos de `resistencia.test.ts` («el host cierra la sala» y «el host muere de golpe») siguen en verde. Una tercera: SIGTERM, volver a levantar el mismo directorio, entrar con el mismo link y ver el documento (F14). Quien ya recibió el cierre no aparece conectado solo por el hecho de que el host volvió.

**Hecho cuando.** Las tres pasan. **Parar.**

---

## D5 — Quien se quedó en la página vuelve a entrar

**Objetivo.** Tras un SIGKILL, el invitado que conserva el proveedor recibe el documento restaurado sin crear otra página ni otro link. H3-T4.

**Depende de.** D3 y E4, cerrada: no hay tope de 120 s para un rechazo temporal.

**Pruebas.**

- El escenario de D3, midiendo que el proveedor es el mismo objeto.
- Un rechazo temporal dentro de la política de E4 termina en documento restaurado.
- El caso de una ausencia larga hace lo que E4 cerró (F13): no pasa a sala cerrada por el reloj, y entra sola cuando el host vuelve.

**Errores.** Un `host-cerro-la-sala` no entra en este reintento (eso es D4). `host-reemplazado` sigue siendo definitivo.

**Hecho cuando.** La prueba de E4 pasa. **Parar.**

---

## D6 — Quien dibujó sin red se fusiona

**Objetivo.** H3-T5. El log de H2 no se reescribe: se usa.

**Depende de.** D3. El log local de H2 (`y-indexeddb`, una base por sala).

**Pruebas.**

- Proceso: el invitado aplica un update con el host muerto, el host restaura el estado anterior desde disco, al reconectar los dos documentos coinciden y el mapa no duplica la clave (F11). Misma idea que `cruza` en la resistencia, con reinicio de host en medio.
- Navegador: recargar la página del invitado mientras el host está caído no tira el trazo (la prueba de `log-local` más un humo contra la sala restaurada). El humo de navegador se anota en el README de la rama con el resultado.

**Hecho cuando.** La prueba entre procesos pasa. El humo de navegador queda hecho o queda anotado como bloqueado, con la razón. **Parar.**

---

## D7 — Estados visibles

**Objetivo.** H3-T6. La persona distingue conectada, reconectando, esperando al host y sala cerrada con causa. Esos estados ya existen en `EstadoDeLaSala` y en los textos de `pantalla-de-sala.tsx`.

**Depende de.** E4, cerrada. El tope ya no existe: quien espera se queda en «Esperando al host…» y entra sola. Este paso confirma que esos textos alcanzan, o ajusta el que haya quedado describiendo los 120 s.

**Archivos.** `apps/web/src/sala/conexion-a-la-sala/` y la pantalla, **solo** si E4 cambia el tope o pide una causa nueva. Una causa nueva lleva su frase en `POR_QUE_SE_CERRO`: el mapa es exhaustivo y no compila sin ella.

**Pruebas.** Las de `conexion-a-la-sala.test.ts` que ya cubren `esperando-al-host` y `reconectando`, actualizadas si E4 cambia el tope. No se añade un estado paralelo con otro nombre para el mismo hecho.

**Hecho cuando.** E4 está reflejada en la prueba, o el README de la rama dice que los textos actuales alcanzan y no hubo diff de web. **Parar.**

---

## D8 — Compactación

**Objetivo.** H3-T3, en los términos de E3.

**Depende de.** E3, cerrada el 2026-11-12: el estado codificado ya cumple H3-T3.

**Este paso no tiene código.** El README de la rama lo anota. La frase del v2 queda para H4: se compacta al commitear y el commit guarda el estado, no todo el historial de deltas.

**Hecho cuando.** Quedó constancia de que no hay código. **Parar.**

---

## D9 — Resistencia y cierre de la épica

**Objetivo.** H3-T7 y el definition of done. Regresiones incluidas, no solo el camino nuevo.

**Depende de.** D1–D7, y D8 según E3.

**Pruebas, en el arnés que ya existe** (`resistencia`, proxy de red, procesos reales):

| Caso | Error |
|------|--------|
| SIGKILL del host y segundo proceso con el mismo disco | F1, F7, F8 |
| SIGTERM, cierre definitivo, segundo proceso, el mismo link abre el documento y el invitado anterior no entra solo | F2, F14 |
| Orquestador SIGKILL y vuelta | F9 |
| Red partida, corte súbito, 300 ms de latencia | F15 y las pruebas actuales |
| Invitado escribe sin red durante el reinicio del host | F11 |
| Segundo proceso sobre el mismo archivo | F10. Falla al abrirlo con `database is locked` y no se registra |
| Almacén ilegible en un arranque de proceso | F3 |

No entra aquí el commit intacto ni apagar la réplica central: no existen en esta épica.

**Verificación del cierre.**

1. Typecheck de `apps/host`, `apps/web` y `packages/pruebas-entre-procesos`.
2. Las pruebas de esos paquetes, incluida la resistencia.
3. Humo manual: dibujar, parar el host, volver a levantarlo, abrir el mismo link, ver el tablero. Anotarlo en el README.
4. Casos fuera: commits, réplica, migración de host, dos redes (checklist residual de H1/H2), Expo.
5. Cuando el comportamiento lleve un rato estable, alinear la frase de `docs/fijos/` que todavía dice que la sala vive en memoria, y la fila de seguridad del v2 sobre el link. Eso es otra autorización: no se edita `docs/fijos/` dentro de un paso de código sin pedirla.

**Hecho cuando.** Lo anterior está anotado en el README de esta rama y el chat da la épica por probada.
