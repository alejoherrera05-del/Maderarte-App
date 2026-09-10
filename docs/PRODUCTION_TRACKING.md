# Seguimiento por mueble

El diseño aprobado es la propuesta del 10 de septiembre con lista amplia y detalle enfocado. En móvil la lista abre un solo mueble y conserva el regreso. Categoría determina el icono; no se infiere del nombre. Categorías nuevas: SOFA, SILLA, MESA, además de las siete existentes.

Produccion conserva un evento por registro con Produccion_ID igual al Request_ID. Observaciones usa JSON contrato 1 con cantidad, fecha y nota. Se conserva quién registró, proveedor, hora de registro y estado. No se alteran filas históricas. Registros anteriores sin contrato se bloquean para conciliación.

Pasos: SOLICITADO, CONFIRMADO, FABRICACION, LISTO, TRANSPORTE, BODEGA. Cada registro expresa unidades adicionales de ese paso, no un total acumulado. Ningún paso se inventa al registrar otro. Es posible registrar llegada directa. Los totales por paso nunca superan las unidades activas. Recepción y despacho son distintos: disponible = recibido menos despachado para muebles de fábrica. Las remisiones siguen siendo la única forma de registrar salida al cliente.

Escritura: produccion.update, sede autorizada, orden activa, versión vigente, verificación declarada, ScriptLock y batch atómico con auditoría e idempotencia. La barrera durable conserva intentos inciertos. El navegador conserva un intento en la sesión y consulta antes de repetir.

Activación: ensayo del propietario habilitado; operación comercial requiere COMMERCIAL_WRITES, MODO_OPERACION=OPERACION y PRODUCTION_SAVE_ENABLED=SI. No habilita automáticamente ventas reales. PR contiene backend; se debe desplegar el Cerebro del mismo commit.

Límite: no se editan ni borran eventos. Correcciones de cantidades ya registradas requieren un futuro movimiento de ajuste. No se envía WhatsApp automáticamente.
