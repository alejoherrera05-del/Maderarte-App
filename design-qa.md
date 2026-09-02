# Design QA — Etapa 4.1 Maderarte App

## Alcance

Esta revisión conserva la dirección visual aprobada del nuevo inicio y corrige coherencia, legibilidad y comportamiento entre pantallas.

## Decisiones vigentes

- Identidad Maderarte con naranja, grafito, dorado, blanco y grises neutros.
- Logo oficial optimizado para web y wordmark rasterizado desde el recurso aprobado.
- Inicio con banner interiorista dinámico por momento del día, saludo personalizado y navegación por Comercial, Operación y Gestión.
- Configuración vive en el menú de perfil/sistema y no dentro de Gestión.
- Las funciones todavía no disponibles se muestran como tales antes del clic.
- Las subopciones operativas usan una ventana tipo bottom sheet: overlay oscurecido con blur y panel que emerge desde la parte inferior; en móvil ocupa todo el ancho y respeta safe area.
- La entrada del bottom sheet usa `translateY(100%) → translateY(0)` con transición elástica de 0.4 s para conservar la respuesta táctil aprobada en la referencia operativa.
- Tema claro es la experiencia estable de esta fase; el modo oscuro se reintroducirá cuando todas las pantallas lo soporten con la misma calidad.
- El login y la activación de cuenta usan el mismo lenguaje visual del inicio y conservan intacta la lógica de autenticación.
- La navegación de páginas interiores conserva la misma marca, paleta, iconografía y jerarquía del inicio.

## Tipografía y legibilidad

- Pila del sistema: SF Pro / San Francisco en dispositivos Apple y `Segoe UI Variable` / `Segoe UI` como sustituto natural en Windows, sin distribuir archivos de fuente.
- Pesos visuales normales entre 400, 500 y 600; se evita una interfaz gruesa o pesada.
- Texto principal alrededor de 15–16 px.
- Información secundaria legible, con piso aproximado de 14 px cuando es contenido que el usuario debe leer.
- Inputs de login en 16 px para evitar zoom en Safari/iPhone.
- Acciones con alturas táctiles cómodas.
- Descripciones móviles pueden ocupar más de una línea; no se comprimen para ahorrar altura.

## Funcionalidad visual

- Órdenes de pedido continúa siendo el módulo operativo disponible desde el inicio.
- Los demás módulos de la Etapa 4 permanecen visibles como arquitectura de producto, pero sin falsas acciones.
- No se muestra un indicador de notificación si no existen notificaciones reales.
- El footer sigue el patrón operativo aprobado: sello/marca, nombre del sistema y la versión REAL del código con el año. En esta rama debe mostrar `VERSIÓN 0.2.0 © 2026`.

## Evidencia

Las capturas intermedias de QA no se conservan en Git para evitar inflar el repositorio. La revisión visual se realiza sobre la Preview URL del PR y las validaciones automáticas del repositorio.

## Barreras

- `COMMERCIAL_WRITES` permanece en `false`.
- No se habilitan clientes, cotizaciones, abonos, producción, remisiones, PDFs ni WhatsApp.
- No se modifican DNS, Cloudflare secrets, Google Sheets, Drive ni Apps Script en esta subetapa.
