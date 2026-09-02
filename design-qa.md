# Design QA — Etapa 4.1 Maderarte App

## Alcance

La revisión actual conserva la identidad propia de Maderarte y eleva el Inicio hacia una experiencia más editorial, ligera y cercana al estándar visual ya aprobado en la app operativa de referencia.

## Decisiones vigentes

- Identidad Maderarte con naranja, grafito, dorado, blanco y grises neutros.
- Logo oficial y wordmark integrados de forma sutil dentro del banner del Inicio; se elimina el encabezado de marca pesado en esa pantalla.
- Controles superiores del Inicio reducidos a acciones circulares de notificaciones y perfil.
- La campana no simula alertas: si se abre sin datos, comunica que no hay notificaciones nuevas.
- Inicio con banner interiorista dinámico por momento del día, saludo personalizado y navegación por Comercial, Operación y Gestión.
- Los tres banners comparten una sala residencial coherente inspirada en el sofá aprobado: tapizado bouclé crema, estructura redondeada en nogal, mesa auxiliar, arte, planta, cortinas y lámpara de piso.
- La iluminación sigue una lógica real: lámpara apagada durante mañana y tarde; encendida únicamente en la escena nocturna.
- Las imágenes finales se entregan en WebP de 1920 × 480, sin textos, logos generados, manchas oscuras, ruido visible ni sombras duras de ventana.
- Los grupos del Inicio usan una sola superficie limpia por sección; se eliminan dobles cajas, bordes repetidos y sombras innecesarias.
- Los iconos de módulos se reducen de tamaño y profundidad para evitar una estética de plantilla o tablero genérico.
- Configuración vive en el menú de perfil/sistema y no dentro de Gestión.
- Las funciones todavía no disponibles se muestran como “En preparación” antes del clic.
- Las subopciones operativas usan bottom sheet desde la parte inferior, con overlay, blur, safe area y transición elástica.
- Tema claro es la experiencia estable de esta fase; el modo oscuro se reintroducirá cuando todas las pantallas lo soporten con la misma calidad.
- El login conserva el mismo lenguaje visual del sistema y la lógica de autenticación permanece intacta.
- La navegación de páginas interiores conserva la misma marca, paleta, iconografía y jerarquía del sistema.

## Tipografía y legibilidad

- Pila del sistema: SF Pro / San Francisco en Apple y Segoe UI Variable / Segoe UI en Windows.
- Pesos predominantes entre 400 y 600.
- Texto principal alrededor de 15–16 px.
- Información secundaria legible, con piso aproximado de 14 px cuando es contenido que el usuario debe leer.
- Inputs de login en 16 px para evitar zoom en Safari/iPhone.
- Acciones con alturas táctiles cómodas.
- Descripciones móviles pueden ocupar más de una línea; no se comprimen para ahorrar altura.

## Funcionalidad visual

- Órdenes de pedido continúa siendo el módulo operativo disponible desde el Inicio.
- Los demás módulos permanecen visibles como arquitectura del producto, sin simular funcionalidad que todavía no existe.
- El footer muestra la versión real de la aplicación y el año.
- La marca de Maderarte no compite con el contenido: el banner concentra identidad y saludo; el resto de la interfaz prioriza la operación.

## Evidencia

Las capturas intermedias de QA no se conservan en Git para evitar inflar el repositorio. La revisión visual se realiza sobre la Preview URL del PR y las validaciones automáticas del repositorio. El nuevo encuadre del banner fue comprobado localmente en 1440 × 900 y 390 × 844, sin errores de consola ni desplazamiento horizontal.

## Barreras

- `COMMERCIAL_WRITES` permanece en `false`.
- No se habilitan clientes, cotizaciones, abonos, producción, remisiones, PDFs ni WhatsApp.
- No se modifican DNS, Cloudflare secrets, Google Sheets, Drive ni Apps Script en esta subetapa.
