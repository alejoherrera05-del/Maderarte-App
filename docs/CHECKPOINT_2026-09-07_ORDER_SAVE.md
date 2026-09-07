# Guardado de órdenes — etapa iniciada el 7 de septiembre de 2026

Base verificada: `b6c3b3dbfb729e27364e585c9536d9b906655681`, PR #16 publicado. Rama: `feat/order-save-foundation`.

## Aprobación del propietario

El propietario aprobó expresamente el formulario y documento publicados y solicitó continuar con el funcionamiento. Se conserva el diseño; no se recuperan el bloque de acuerdo común ni la distribución visible de saldos por mueble. El trabajo de esta etapa es persistencia y recuperación, no un rediseño.

## Alcance de trabajo

1. Inspeccionar el contrato real de Apps Script, permisos, esquema de Sheets y Drive.
2. Preparar captura y validación de cliente, artículos, acuerdos, pagos separados y notas internas.
3. Implementar protección de numeración e idempotencia: un reintento no genera otra orden ni cobra de nuevo.
4. Probar importes, privacidad, autorización, interrupciones y lectura posterior.
5. Publicar únicamente cambios comprobados. Mantener PREPARACION y el bloqueo de escrituras hasta verificar el backend desplegado y sus dependencias reales.

## Reglas que no cambian

Google Sheets/Drive exclusivos de Maderarte; sin importaciones. Acuerdo de entrega no equivale a remisión. Solicitar a fábrica no equivale a producción iniciada. La nota interna no es una observación pública. La aprobación del diseño no certifica transacciones reales.

Este checkpoint registra el inicio, no declara terminado ni habilitado el guardado.
