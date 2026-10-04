# `@harukoia/pruebas-entre-procesos`

Pruebas que necesitan **más de un proceso vivo a la vez**: orquestador y host juntos, y más adelante un invitado conectándose a través del relay.

No viven dentro de `apps/orchestrator` ni de `apps/host` porque no tienen un dueño único: fallan cuando cualquiera de los dos se rompe.

## Qué va aquí y qué no

| Tipo de prueba | Dónde vive |
|----------------|------------|
| Una función, una clase, un módulo | Junto al código que prueba, en su misma carpeta |
| Un proceso completo contra sí mismo | Junto al código de ese proceso |
| **Dos o más procesos a la vez** | **Aquí** |
| Navegador real contra el motor | Aquí, cuando exista (H2 en adelante) |

## Reglas

1. Cada prueba **levanta y tumba** lo que necesita. Ninguna depende de que otra haya corrido antes.
2. **Puerto cero**: los procesos piden puerto al sistema y la prueba lo lee de su salida. Nunca puertos fijos.
3. **Tiempo máximo explícito** en todo lo que abre un socket o lanza un proceso.
4. Nada de PM2 ni del proxy de desarrollo: las pruebas hablan directo con los procesos.

```bash
pnpm --filter @harukoia/pruebas-entre-procesos test
```
