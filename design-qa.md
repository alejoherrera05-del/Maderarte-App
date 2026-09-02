# Design QA — Etapa 4.1 Maderarte App

## Alcance

Esta revisión conserva la dirección visual aprobada del nuevo inicio y corrige coherencia, legibilidad y comportamiento entre pantallas.

## Decisiones vigentes

- Identidad Maderarte con naranja, grafito, dorado, blanco y grises neutros.
- Logo oficial optimizado para web y wordmark rasterizado desde el recurso aprobado.
- Inicio con banner interiorista dinámico por momento del día, saludo personalizado y navegación por Comercial, Operación y Gestión.
- Configuración vive en el menú de perfil/sistema y no dentro de Gestión.
- Las funciones todavía no disponibles se muestran como tales antes del clic.
- Las subopciones operativas usan diálogo centrado en escritorio y bottom sheet en móvil.
- Tema claro es la experiencia estable de esta fase; el modo oscuro se reintroducirá cuando todas las pantallas lo soporten con la misma calidad.
- El login usa el mismo lenguaje visual del inicio y conserva intacta la lógica de autenticación.
- La navegación de páginas interiores conserva la misma marca, paleta, iconografía y jerarquía del inicio.

## Legibilidad

- Texto principal alrededor de 15–16 px.
- Información secundaria legible, con piso aproximado de 14 px cuando es contenido que el usuario debe leer.
- Inputs de login en 16 px para evitar zoom en Safari/iPhone.
- Acciones con alturas táctiles cómodas.
- Descripciones móviles pueden ocupar más de una línea; no se comprimen para ahorrar altura.

## Funcionalidad visual

- Órdenes de pedido continúa siendo el módulo operativo disponible desde el inicio.
- Los demás módulos de la Etapa 4 permanecen visibles como arquitectura de producto, pero sin falsas acciones.
- No se muestra un indicador de notificación si no existen notificaciones reales.
- El footer conserva únicamente el eslogan aprobado; la versión técnica queda fuera de la experiencia diaria.

## Evidencia

Las capturas intermedias de QA no se conservan en Git para evitar inflar el repositorio. La revisión visual se realiza sobre la Preview URL del PR y las validaciones automáticas del repositorio.

## Barreras

- `COMMERCIAL_WRITES` permanece en `false`.
- No se habilitan clientes, cotizaciones, abonos, producción, remisiones, PDFs ni WhatsApp.
- No se modifican DNS, Cloudflare secrets, Google Sheets, Drive ni Apps Script en esta subetapa.
