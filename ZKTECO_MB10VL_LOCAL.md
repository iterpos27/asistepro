# Conexion local ZKTeco MB10-VL

AsistePro puede consultar el MB10-VL directamente por la red local, importar sus registros y volver a consultar sin duplicar marcaciones.

## Preparar el reloj

1. Conecta el MB10-VL y el computador servidor a la misma red.
2. En el reloj abre `Menu > COMM > Ethernet` y asigna una IP fija privada, por ejemplo `192.168.1.201`.
3. Confirma que el puerto de comunicacion sea `4370` y que la comunicacion independiente/standalone este habilitada si el firmware muestra esa opcion.
4. El `ID de usuario` creado en el reloj debe ser exactamente igual al campo `codigo` del empleado en AsistePro.
5. Configura correctamente la fecha y hora del reloj.

## Configurar AsistePro

En `Integraciones`, crea una integracion de tipo `Biometrico`. Al escoger ese tipo aparece una plantilla como esta:

```json
{
  "modo_conexion": "directo",
  "ip": "192.168.1.201",
  "puerto": 4370,
  "timeout_ms": 10000,
  "puerto_udp_local": 4000,
  "sucursal_id": "UUID-DE-LA-SUCURSAL",
  "intervalo_segundos": 60,
  "dias_importar": 30,
  "zona_horaria_offset": "-05:00"
}
```

Guarda la integracion y pulsa `Ejecutar` para la primera prueba. En modo local, el backend revisa automaticamente las integraciones activas cada 30 segundos y respeta el intervalo configurado para cada reloj.

## Criterio de entrada y salida

Por cada empleado y dia, dos registros se interpretan como entrada y salida. Con cuatro registros se interpretan como entrada, salida a almuerzo, entrada de almuerzo y salida. Si inicialmente hay menos registros, la siguiente sincronizacion reconcilia el tipo cuando aparecen nuevas marcaciones.

## Diagnostico rapido

- Desde el computador, prueba `Test-NetConnection IP_DEL_RELOJ -Port 4370`.
- Si no responde, revisa IP, mascara de red, puerto, cable/Wi-Fi y la regla del Firewall de Windows.
- Revisa `Integraciones > Bitacora reciente` para ver errores de usuario no encontrado, sucursal o conectividad.
- Para deshabilitar el proceso automatico usa `ENABLE_BIOMETRIC_SYNC=false` en el entorno local.

El sistema nunca elimina los registros almacenados en el reloj.

## Vincular IDs diferentes sin renombrar empleados

Si el ID del reloj no coincide con el codigo de AsistePro, agrega a la configuracion:

```json
{
  "usuarios_mapeo": { "2": "AMIN_ALARCON" },
  "fecha_desde": "2026-09-02"
}
```

Estas propiedades se agregan a la configuracion de IP y sucursal, no la reemplazan.
Cuando existe `usuarios_mapeo`, se importan exclusivamente los IDs incluidos y confirmados.
Una lista vacia no importa a nadie. `fecha_desde` limita por fecha local (inclusive),
ademas de la ventana de `dias_importar`. No se modifica ningun usuario en el reloj.

## Pantalla de usuarios y pendientes

En **Integraciones**, pulsa **Usuarios del biométrico** en el equipo de MATRIZ.
La consulta lee los IDs, nombres y marcaciones desde la fecha elegida. No descarga
plantillas de huellas/rostros ni expone claves o tarjetas del SDK. Los pendientes
se consultan en el reloj: esta pantalla no constituye una copia de seguridad.

1. Busca un ID (por ejemplo, 52) o filtra usuarios sin vincular.
2. Pulsa **Vincular empleado**, selecciona el empleado real y revisa su sucursal.
3. Elige la fecha inicial y pulsa **Confirmar vínculo e importar**.
4. Revisa el resultado y los errores. Si el equipo se desconecta, el vínculo ya
   guardado permanece y la sincronización activa reintenta más adelante.

La fecha se guarda en `usuarios_fecha_desde` para ese ID; prevalece sobre la fecha
global y la ventana de días sin afectar a otros empleados. Se admiten fechas no
futuras de los últimos 10 años. Los vínculos existentes ofrecen **Recuperar
marcaciones** para cambiar su fecha inicial sin reasignar la identidad. El cambio
de fecha no elimina registros ya importados. No se permite asociar dos IDs del
mismo equipo al mismo empleado ni reasignar un ID que ya tiene otro empleado.

Permisos: consultar requiere `integraciones/ver`; confirmar vínculo y recuperar
requiere `integraciones/editar` y `integraciones/exportar`, además del rol,
empresa y plan autorizados. Los vínculos se auditan en la bitácora. La operación
no activa una integración pausada. En local, mantener backend y red encendidos.

La bitácora automática informa `usuarios_sin_vincular` y
`marcaciones_sin_vincular` dentro de la ventana global de sincronización. La
pantalla permite consultar otro rango explícito. “Sin importar” también puede
incluir eventos excedentes o rechazados por las reglas de asistencia; revisar
errores antes de repetir la recuperación.

## Producción: alcance de esta versión y siguiente paso

Subir este código no conecta la nube a la LAN de MATRIZ. La IP privada del reloj
solo es accesible desde una red con ruta hacia él. La interfaz de Vercel llama
a la API configurada, no abre una conexión TCP al reloj desde el navegador.
Las consultas directas de usuarios también se ejecutan en el backend y, por
tanto, no funcionarán en Render contra la IP local sin un puente o red privada.

La sincronización directa está deshabilitada por defecto con
`NODE_ENV=production`. No basta activar `ENABLE_BIOMETRIC_SYNC`: hace falta la
conectividad real. No publicar el puerto 4370 del reloj en Internet.

Arquitectura propuesta (todavía no implementada):

```text
Reloj de MATRIZ -- TCP local 4370 --> Agente en PC local
Agente -- HTTPS saliente autenticado --> API de producción --> PostgreSQL
Frontend de producción --> API: usuarios, vínculos, pendientes y estado del agente
```

El agente debe ejecutarse como servicio de Windows, iniciar con el equipo y
enviar solo IDs, nombres necesarios y eventos de asistencia (no huellas/rostros).
Necesita una credencial revocable restringida a empresa, sucursal y dispositivo;
no una contraseña de usuario administrador ni credenciales directas de la base.
Debe mantener una cola local persistente, reintentar cuando vuelva Internet y
enviar un ID estable por evento para que la API evite duplicados. La API deberá
recibir y conservar pendientes sin vínculo; la pantalla consultará esos datos
recibidos en vez de abrir un socket contra una IP de MATRIZ.

Esta versión NO contiene aún el agente, la cola ni los endpoints autenticados
de recepción. El endpoint manual `/integraciones/:id/run` no reemplaza ese
contrato: en modo directo intenta leer el dispositivo desde el servidor.

Los usuarios mapeados, la integración y las marcaciones actuales están en la
base local; GitHub publica código, no esos registros. Configurarlos o migrarlos
en producción requiere validar los IDs propios de esa base. La migración 045
solo agrega columnas e índices para trazabilidad/deduplicación de marcaciones.

Referencias de despliegue y red:
- https://render.com/docs/private-network
- https://vercel.com/docs/git
