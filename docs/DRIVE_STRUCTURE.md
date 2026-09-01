# Organización de Google Drive

## Raíz

```text
MADERARTE APP
├── 00_SISTEMA
├── 01_MARCA
├── 02_DOCUMENTOS_CLIENTES
├── 03_PLANTILLAS_PDF
├── 04_BACKUPS
└── 05_INFRAESTRUCTURA
```

## Documentos comerciales

```text
02_DOCUMENTOS_CLIENTES
└── 2026
    └── 09_Septiembre
        └── CC-XXXXXXXXXX - NOMBRE CLIENTE
            ├── 00_COTIZACIONES
            └── MP-OP-0001
                ├── 01_ORDEN_DE_PEDIDO
                ├── 02_RECIBOS_Y_ABONOS
                ├── 03_REMISIONES
                └── 04_SOPORTES
```

## Reglas

- Apps Script crea año, mes, cliente y OP cuando hagan falta.
- El mes se determina por la fecha de creación de la operación.
- El nombre se normaliza; la identificación se conserva como texto.
- La OP contiene todos los documentos de su expediente.
- Los enlaces se guardan en `Clientes`, `Ordenes_Pedido`, `Abonos`, `Remisiones` y `Documentos`.
- Nunca se guarda contenido comercial dentro del repositorio GitHub.
