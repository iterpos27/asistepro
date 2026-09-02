# ADMS en produccion: habilitacion por fases

## Fase 1 implementada: diagnostico HTTPS, sin importacion

`/iclock/*` se atiende antes de los parsers JSON, auditoria y fallback del frontend.
Siempre responde **503**, `X-AsistePro-ADMS: diagnostics-only` y `Retry-After: 60`.
No emite opciones, comandos ni ACK, no guarda cuerpos y no conecta a la base.
Un 503 de esta ruta es intencional: NO significa que el backend este caido.
La salud normal sigue en `/api/health/ready`.

El log `adms_transport_probe` permite correlacionar serie (SHA-256 truncado), hora,
version PUSH y transporte informado por el proxy. Maximo 12 entradas/minuto/proceso,
sin numeros de serie completos, IP, credenciales ni cuerpos. No confundir la serie
declarada con identidad autenticada. `proxy_reported_https` informa lo observado
tras el proxy de Render, no demuestra que el firmware valide el certificado.

### Prueba fisica (solo despues de verificar el despliegue)

Conservar foto de la configuracion actual antes de modificarla. En el reloj:

- Modo: ADMS.
- Habilitar nombre de dominio: SI.
- Direccion del servidor: `asistepro.onrender.com` (sin `https://`, sin ruta).
- Puerto del servidor: `443`.
- HTTPS: SI.
- Proxy: NO.
- Mantener IP propia `192.168.0.131` y TCP `4370` sin cambios.

Registrar hora del cambio. Buscar en Render `adms_transport_probe`, correlacionar
huella de serie y hora. No hacer peticiones sinteticas con la serie real mientras
se espera al equipo: contaminaria la evidencia. Generar la huella localmente:

```powershell
node -e "console.log(require('node:crypto').createHash('sha256').update(process.argv[1]).digest('hex').slice(0,16))" SERIAL
```

Solo si se observa al reloj por HTTPS puede darse por probada esa conectividad.
Una prueba desde Windows o un navegador valida ese cliente, no el MB10.
Si no llega, revisar DNS, gateway, salida 443 y compatibilidad TLS/SNI/cadena de
certificados. No deshabilitar la validacion TLS, abrir 4370 en Internet ni dejar
HTTP publico como solucion. Un fracaso no demuestra por si solo incompatibilidad.

Al concluir, volver a `192.168.0.123:8088`, dominio NO y HTTPS NO **solo en LAN**,
si el piloto esta en ejecucion. El piloto expira tras 60 minutos; comprobar su
`/health` antes de restaurar el destino. Este diagnostico no debe quedar como
solucion operativa: no importa ni confirma asistencia.

## Fase 2 pendiente: recepcion duradera y autenticada

No se monta `adms-pilot.js` en Render. Su fichero local no es almacenamiento central
duradero. Tampoco se habilita importacion basandose solamente en numero de serie.

Antes de habilitar ACK en Internet hay que verificar un mecanismo de autenticacion
que el firmware realmente envie y el servidor pueda validar. Si el equipo no lo
admite, elegir una red privada/VPN o pasarela autenticada en router compatible;
no exige necesariamente una PC por local. HTTPS autentica normalmente al servidor,
pero no identifica por si solo al reloj. No se presume soporte de Bearer, Basic,
certificado cliente ni protocolo de registro solo porque exista la opcion HTTPS.

Diseno de la siguiente fase, sujeto a esa comprobacion:

1. Registrar cada dispositivo en el servidor con empresa, sucursal, serie y
   credencial propia revocable. Los IDs locales no se copian a produccion a ciegas.
2. Guardar ATTLOG y cursor en una transaccion PostgreSQL antes del ACK; deduplicar
   por dispositivo y evento. Rechazar lotes invalidos/fallos de DB sin confirmarlos.
3. Mantener bandeja de eventos recibidos separada de asistencia importada: IDs sin
   vincular y estados sin clasificar quedan pendientes, no se pierden ni se adivinan.
4. Vincular empleados dentro de su empresa, seleccionar fecha inicial y validar
   estados del reloj/reglas laborales antes de incorporar a reportes o nomina.
5. Migrar los pendientes del piloto con deduplicacion y reconciliar conteos: el
   reloj puede no reenviar automaticamente lo ya confirmado por el piloto.
6. Tablas privadas con RLS, sin acceso anon/authenticated por Data API; indices por
   dispositivo/evento y empresa/sucursal/fecha. Pruebas de aislamiento entre locales,
   reintentos, concurrencia, reinicio, caida de DB y recuperacion de pendientes.
7. Comprobar continuidad del alojamiento: el plan gratuito puede suspenderse por
   inactividad. No prometer tiempo real permanente sin verificar el plan operativo.

No se ha creado esta fase, cambiado la base de produccion, publicado el fichero de
marcaciones ni habilitado nuevas reglas de firewall. La ruta de diagnostico puede
quitarse revirtiendo su montaje sin tocar datos.

## Fuentes

- Manual MB10-VL, configuracion de servidor y HTTPS (pagina 36 del PDF):
  https://www.zkteco.com.br/site_marketing/ZK_MB10-VL_Manual.pdf
- TLS de Render: https://render.com/docs/tls
- Plan gratuito: https://render.com/docs/free
- RLS Supabase: https://supabase.com/docs/guides/database/postgres/row-level-security
