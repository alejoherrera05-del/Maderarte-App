# Contratos iniciales de API

Todas las solicitudes usan `POST /api/maderarte` con JSON y `credentials: same-origin`.

## Respuesta común

```json
{
  "status": "success",
  "code": "OK",
  "msg": "Operación completada.",
  "data": {}
}
```

Los errores incluyen `httpStatus`, `code`, `msg` y `requestId`.

## Autenticación

- `AUTH_LOGIN`: intercambia `firebaseIdToken` por sesión propia.
- `AUTH_SESSION_VALIDATE`: valida la cookie de sesión.
- `AUTH_LOGOUT`: revoca la sesión y limpia la cookie.

## Lectura inicial

- `SISTEMA_ESTADO`: conexión, pestañas y cantidades.
- `DASHBOARD_RESUMEN`: métricas y prioridades.
- `ORDENES_LISTAR`: ledger de OP.
- `ORDEN_OBTENER`: OP, productos, abonos, remisiones y documentos.

## Escrituras futuras

Las acciones de creación y edición se incorporarán después de validar autenticación, permisos, Drive, idempotencia y auditoría.
