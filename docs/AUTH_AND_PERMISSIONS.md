# Usuarios, autenticación y permisos

## Firebase compartido

Maderarte usa el proyecto de Firebase Authentication de HomeEasy únicamente para identidad. Esto permite utilizar el mismo correo y contraseña en ambas aplicaciones.

Tener una cuenta en Firebase no concede acceso automático. La persona debe estar autorizada en la pestaña `Usuarios` de Maderarte.

## Alta de usuarios

El registro público está deshabilitado. El flujo previsto es:

1. Propietario o administrador crea una invitación.
2. Se registra correo, rol y sede.
3. La persona activa o reutiliza su cuenta Firebase.
4. En el primer acceso autorizado se vincula el UID Firebase.
5. Maderarte emite su propia sesión.

## Roles iniciales

| Rol | Alcance |
|---|---|
| `PROPIETARIO` | Control total y cuenta protegida |
| `ADMINISTRADOR` | Operación completa, usuarios y configuración |
| `VENDEDOR` | Consulta general y edición de operaciones propias |
| `BODEGA_LOGISTICA` | Producción, entregas y consulta de OP |
| `CONSULTA` | Solo lectura |

## Permisos

Los permisos son cadenas, por ejemplo:

```text
app.access
ordenes.read
ordenes.create
ordenes.update.own
abonos.read
abonos.create
produccion.update
config.read
users.manage
```

El rol `PROPIETARIO` puede usar `*`. Los demás roles reciben una lista explícita desde `Roles.Permisos_JSON`.

## Sesiones

- Apps Script guarda únicamente el hash del token opaco.
- Cloudflare guarda el token real en una cookie HttpOnly.
- El navegador guarda solo perfil y permisos no sensibles para estabilidad visual.
- Suspender un usuario invalida su acceso a Maderarte sin afectar HomeEasy.
- Las escrituras nunca confían únicamente en el perfil almacenado en el navegador.
