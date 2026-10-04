# HaruKoia Space

Documento de contexto inicial del motor de trabajo colaborativo.

## Idea

La idea del proyecto es generar una aplicación web que permita a los usuarios de una organización trabajar de manera colaborativa en una pizarra para compartir ideas, crear planes de trabajo y organizar ideas en juntas. Al finalizar esas juntas, el contenido se debe poder exportar mediante inteligencia artificial en formato markdown, para dar un formato de mayor accesibilidad a sus colaboradores, además de exportación en formatos clásicos como PDF.

Los usuarios deben tener conciencia de quiénes están trabajando y en qué. Mediante un sistema de publish-update, todos los usuarios deben poder transmitir la información de juntas, ideas o avances de trabajo a sus colaboradores sin necesidad explícita de entrar a la aplicación web.

## Necesidad

Se requiere un motor de trabajo colaborativo que permita lo siguiente:

- Pizarra interactiva en tiempo real.
- Procesado de la información mediante inteligencia artificial para convertir esas entradas en documentos markdown.
- Motor de generación de documentos, para exportar esos markdown a PDF y Word.
- Base de datos que permita compartir esos markdown mediante un sistema de publish a cualquier usuario que exista en el sistema, de modo que en sus dispositivos puedan utilizar comandos como `space update` en su CLI y este actualice la documentación de sus repositorios con los nuevos markdown generados en la pizarra, la documentación o el contenido multimedia.

## Por qué

La diferencia frente a las pizarras actuales es la siguiente:

- Capacidad nativa de actualizar la información a sus colaboradores de forma local.
- Integración nativa de markdown.
- Formatos claros para programadores.
- Conciencia del trabajo incluso fuera de la pizarra.

## Alcance

Este software está pensado para desarrolladores, como software interno de las empresas. No está pensado para el uso público; para ello existen soluciones más sencillas.

La idea es solucionar la comunicación con formatos apropiados para código, uso de agentes de IA y repositorios dentro de una empresa. Debe permitir comunicar planes de acción, avances, y tener un registro de juntas e ideas que cada usuario tenga. El valor nace de las posibilidades que abre a una empresa para comunicar asuntos de importancia que influyen directamente en el desarrollo.
