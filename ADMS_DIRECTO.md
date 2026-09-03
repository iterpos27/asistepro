# ADMS directo a produccion

El reloj envia por HTTPS a `asistepro.onrender.com`; no se consulta su IP LAN
desde Render y no hace falta una PC encendida. Dominio activado, HTTPS activado,
proxy desactivado. Conservar la IP fija LAN y el puerto TCP 4370 del reloj.

En Integraciones > Bandeja ADMS, registrar serie y sucursal y activar recepcion
directa. Por defecto permanece pausada; solo un administrador con permisos de
edicion y exportacion puede activarla o pausarla. La decision queda auditada.

## Alcance y seguridad

- La serie declarada enruta hacia una bandeja; NO autentica al remitente.
- Los eventos de Internet se etiquetan `adms_sin_verificar`; nunca se incorporan
  automaticamente a asistencia, reportes ni nomina. El administrador comprueba
  procedencia, empleado y tipo antes de usar la importacion individual existente.
- Solo ATTLOG y el informe de capacidades: no usuarios, claves, fotos ni plantillas.
- No se envian comandos para cambiar hora, usuarios o borrar registros.
- `OK: cantidad` se entrega solo despues del COMMIT de todo el lote. Los fallos
  devuelven error para permitir reintento. Duplicados usan la misma referencia
  que el piloto, sin perder el origen ni duplicar la asistencia ya importada.
- No se confia en el Stamp recibido: handshake con Stamp=0 para recuperar historial.
  Al reconectar pueden llegar registros antiguos y duplicados; esto es esperado.
- Limites: HTTPS, 4 solicitudes concurrentes y 300/minuto por proceso, 512 KiB y
  10.000 eventos/lote, 250.000 eventos/equipo. Al alcanzar capacidad se rechaza el
  lote completo sin ACK; requiere revision administrativa, nunca borrado automatico.
- No hay acceso publico de lectura ni nuevos permisos Data API en Supabase.

La pantalla actualiza cada 30 segundos (pausa mientras se edita una importacion).
Actualizar bandeja consulta datos YA recibidos; no fuerza una lectura LAN.
Ultimo contacto indica conexion con serie declarada, no autenticacion.
Ultimo lote guardado confirma persistencia. Un contacto sin lote no prueba recepcion
de marcaciones; verificar ambos y una marcacion conocida antes de darlo por operativo.

Para futura importacion automatica a asistencia se necesita autenticar al equipo
o aislar el transporte y confirmar el significado de sus estados. No deducir tipos
por posicion de eventos ni extrapolar una salida confirmada a todo el firmware.
