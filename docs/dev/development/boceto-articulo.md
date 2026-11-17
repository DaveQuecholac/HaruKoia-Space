# Boceto del artículo — HaruKoia

Primera pasada a lápiz. No es el texto de la revista. Cada apartado dice qué vamos a contar y qué todavía no tenemos. Si un dato no está, el hueco se queda vacío.

Una sola publicación, un solo proyecto.

## Índice

1. Título
2. Autores y filiación
3. Resumen y palabras clave
4. Introducción
5. Trabajos relacionados
6. Método
7. El proyecto
8. Resultados
9. Discusión
10. Conclusiones y trabajo futuro
11. Referencias

## 1. Título

Vamos a poner una frase corta que diga de qué va el sistema.

Hoy podemos apoyar el título en esto: es una pizarra para que un equipo de desarrollo trabaje junto en una junta, y que lo que quedó ahí pueda salir como documento. El nombre del proyecto es HaruKoia.

La frase exacta del título queda en blanco.

## 2. Autores y filiación

Vamos a poner quién firma y de dónde (materia, escuela).

Hoy eso no está anotado en el proyecto. Se deja en blanco: nombres, materia, escuela, y quién va como autor responsable.

## 3. Resumen y palabras clave

Vamos a poner un párrafo corto con cuatro datos, en este orden: qué problema hay, qué estamos haciendo, qué ya se puede ver, y hasta dónde llega hoy.

Cuando lo escribamos, en ese párrafo entran solo estas tres cosas:

- Varias personas entran a una sala con un link y se ven entre sí.
- Dibujan en la misma pizarra al mismo tiempo.
- La idea de fondo es que, al cerrar, eso se vuelva documentación en el repositorio de quien no estuvo. Eso todavía no está hecho.

Las palabras clave se eligen después. Unas candidatas, solo para no perder el tema: pizarra, trabajo colaborativo, documentación. No están cerradas.

Si la revista pide el resumen también en inglés, se hace cuando el párrafo en español ya esté escrito.

## 4. Introducción

Vamos a poner, en prosa simple, cuatro cosas:

- Para quién es: equipos de desarrollo dentro de una empresa. No es una pizarra para el público general.
- Qué les falta, según la idea del proyecto: al terminar una junta, lo dibujado no queda en un formato que el resto del equipo use en sus repositorios, y quien no abrió la pizarra no se entera.
- Qué quiere ser HaruKoia: una sala compartida y, al final, un documento que se pueda repartir.
- Cómo sigue el artículo: qué ya corre y qué sigue en el plan.

No vamos a inventar cifras de empresas ni una cita de apertura.

## 5. Trabajos relacionados

Vamos a poner otras pizarras o formas de dejar constancia de una junta, cada una con su fuente.

Hoy el proyecto solo dice, en sus propias palabras, en qué quiere distinguirse: que la información llegue a la máquina del colaborador, que el markdown sea parte del sistema, que el formato le sirva a quien programa, y que se note el trabajo aunque la persona no esté dentro de la pizarra.

No hay lista de productos ni de artículos leídos. Esta sección se queda vacía hasta que juntemos esas fuentes. No se rellena de memoria.

## 6. Método

Vamos a poner cómo se está construyendo. No hay un estudio con usuarios, así que no se describe un experimento.

Lo que sí podemos contar:

- Se construye por partes que se pueden probar. El orden es: entrar a la sala, dibujar, no perder el tablero, guardar versiones, publicar el documento, pasar la pizarra por un modelo de inteligencia artificial, y al final una sala que viva en un servidor.
- Cada persona entra con un link y un nombre. Todavía no hay cuentas de usuario.
- De cada sala hay un dueño: los datos de esa sala y lo que se guarda como versión oficial pasan por él.
- Hay un registro de salas que reparte el link. El dibujo en vivo va por ese camino. El guardado de largo plazo es otro camino, y todavía no está construido.

No hay encuesta, rúbrica ni grupo de prueba. Eso no se inventa.

## 7. El proyecto

Vamos a poner qué es el sistema y qué partes ya se pueden mostrar.

La idea completa, aunque no esté toda construida:

- Pizarra en vivo.
- Al cerrar, un documento en markdown. La primera forma de ese documento sería fija: versión, participantes, fecha y notas del tablero. Otra forma la redactaría un modelo. Ninguna de las dos está hecha.
- Exportar también a PDF y Word. No está hecho.
- Que alguien que no estuvo pueda traer ese archivo a su repositorio. No está hecho.

Lo que ya corre y se puede describir:

- Se abre el motor, se crea una sala, otra persona entra con el link y se ve quién está.
- En la sala hay un dueño y quien se une.
- En la pizarra, varias personas dibujan a la vez, se ven el cursor y el nombre, y si a alguien se le cae la red puede seguir dibujando; al volver, el trazo se junta con el de los demás.
- La pantalla de hoy es la de la web. La aplicación de teléfono está escrita como diseño y no está construida. Un teléfono puede abrir el link. No puede ser el dueño de la sala.

## 8. Resultados

Vamos a poner solo lo que ya se probó, diciendo cómo.

Lo que hay:

- La entrada por link y la lista de quién está están hechas. El paso entre dos redes distintas se probó una vez. La demostración completa en dos máquinas sigue pendiente.
- La pizarra se aprobó usándola, el 9 de noviembre de 2026: varias personas dibujando a la vez, cursores con nombre, y seguir dibujando sin red.
- La velocidad de un trazo se midió ese mismo día, en la misma máquina: la mitad de los casos en 0.7 ms y el peor en 3.2 ms. El objetivo que se había puesto era quedar debajo de 150 ms. Esa medición no es entre dos redes.

Lo que no hay, y no se va a simular: una junta real con el grupo de la materia, documentos generados, ni alguien recibiendo el archivo en su repositorio.

## 9. Discusión

Vamos a poner qué se puede afirmar con lo de arriba, y el límite al lado.

Se puede afirmar que ya existe una sala compartida donde varias personas dibujan y se ven.

El límite, dicho tal cual: el motor va por la sala y la pizarra. Cerrar la máquina y no perder el tablero, guardar una versión, y que el documento llegue a quien no estuvo, siguen sin construirse. La medición de velocidad es local. La inteligencia artificial y el PDF no tienen resultado porque esa parte no existe todavía.

## 10. Conclusiones y trabajo futuro

Vamos a poner tres o cuatro frases cuando las secciones de arriba estén escritas. Hoy el cierre realista es este:

- Ya se puede entrar y dibujar juntos.
- Lo que distingue al proyecto de una pizarra cualquiera —el documento que llega al repositorio— todavía no está.
- Lo que sigue, en el orden del propio plan, es que el tablero no se pierda al cerrar la máquina de quien es dueño de la sala.

No se adelanta una conclusión de que el sistema ya resuelve la comunicación de una empresa.

## 11. Referencias

Vamos a poner las fuentes que sí leamos, en el formato que pida la revista.

Hoy la lista está vacía.
