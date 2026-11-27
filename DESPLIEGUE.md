# Guía de Configuración, Despliegue y Operación — App-FYAG

Esta guía documenta los requisitos y pasos para desplegar **App-FYAG** (Backend Node.js/Express + PostgreSQL y Frontend Expo Web / Android / iOS) en entornos de desarrollo y producción.

---

## 1. Configuración de PostgreSQL, Mínimo Privilegio, Red y Migraciones

### 1.1 Separación de cuentas (principio de mínimo privilegio)
Nunca usar `postgres`, `root` ni superusuarios para ejecutar la aplicación (el validador `backend/config/entorno.ts` aborta el arranque en producción si `DB_USER` es un superusuario). Se recomienda separar el rol dueño del esquema (`fyag_owner`, usado para DDL/migraciones) del rol de la aplicación (`fyag_app`, limitado a operaciones DML):

```sql
-- 1. Rol dueño del esquema (sin privilegios de superusuario)
CREATE ROLE fyag_owner WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE ENCRYPTED PASSWORD 'CLAVE_MIGRACIONES_SEGURA';
CREATE DATABASE fyag_db OWNER fyag_owner ENCODING 'UTF8';

-- 2. Cuenta de la aplicación con permisos mínimos (solo lectura/escritura de filas, sin DROP ni DDL peligroso)
CREATE ROLE fyag_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE ENCRYPTED PASSWORD 'CLAVE_APP_SEGURA';
GRANT CONNECT ON DATABASE fyag_db TO fyag_app;

\c fyag_db
GRANT USAGE ON SCHEMA public TO fyag_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fyag_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fyag_app;
ALTER DEFAULT PRIVILEGES FOR ROLE fyag_owner IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fyag_app;
ALTER DEFAULT PRIVILEGES FOR ROLE fyag_owner IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO fyag_app;
```

### 1.2 Restricción de red y TLS (`postgresql.conf` y `pg_hba.conf`)
Aplica a un PostgreSQL propio; en Supabase esta capa la gestiona la plataforma.
No exponer el puerto `5432` a Internet público:
1. En `postgresql.conf`, escuchar únicamente en loopback o en la subred privada interna y exigir SSL/TLS:
   ```ini
   listen_addresses = '127.0.0.1,10.0.1.10'
   ssl = on
   ```
2. En `pg_hba.conf`, aceptar solo conexiones TLS (`hostssl`) desde la IP privada del backend con autenticación `scram-sha-256`:
   ```text
   hostssl fyag_db fyag_app 10.0.1.0/24 scram-sha-256
   ```

### 1.3 Esquema de base de datos y migraciones
La base se aprovisiona **una sola vez** con el esquema consolidado y los datos semilla:

1. Ejecutar [estructura_db.md](file:///c:/Users/Socius/Desktop/xs/App-FYAG/estructura_db.md) (esquema completo, equivalente a las migraciones `001`–`021`).
2. Ejecutar [datos_iniciales.md](file:///c:/Users/Socius/Desktop/xs/App-FYAG/datos_iniciales.md) (datos semilla y cuentas principales, equivalente a la migración `022`).

Esos dos archivos son la **fuente de verdad** del esquema. Los scripts de `backend/migraciones/` se conservan solo como historial y **no deben ejecutarse** sobre una base aprovisionada así: algunos chocan con el esquema consolidado (por ejemplo, `devoluciones_tecnico` es una vista de compatibilidad, no una tabla).

El motor `backend/services/migraciones.ts` controla este comportamiento con la variable `APLICAR_MIGRACIONES`:

| Valor | Comportamiento |
|---|---|
| `false` (**recomendado** en Supabase y en bases creadas con `estructura_db.md`) | Omite las migraciones al arrancar y lo informa en consola. |
| sin definir / `true` | Ejecuta en cada arranque, en orden alfabético, todos los `.sql` de `backend/migraciones/`. Son idempotentes (`IF NOT EXISTS` / `ON CONFLICT`), pero **no se registran** en ninguna tabla de control ni se ejecutan en una transacción única. Solo es apto para bases creadas de forma incremental. |

**Cambios futuros al esquema:** aplícalos en la base (por ejemplo, con una migración de Supabase) y actualiza `estructura_db.md` para que siga siendo la fuente de verdad. No agregues scripts nuevos a `backend/migraciones/`.

### 1.4 Supabase (Session Pooler)
Con `DB_HOST` apuntando a `*.pooler.supabase.com`, el backend activa TLS automáticamente. Usa el usuario `postgres.<project_ref>` y la contraseña de la base (Project Settings → Database). En esta configuración `DB_SSL_REJECT_UNAUTHORIZED` es `false` por defecto; para validar el certificado del servidor, descarga la CA desde Project Settings → Database → SSL, defínela en `DB_SSL_CA` y establece `DB_SSL_REJECT_UNAUTHORIZED=true`. Todas las tablas de `public` tienen RLS activo sin políticas, y `anon`/`authenticated` no tienen permisos: solo el backend accede a los datos, por conexión directa a Postgres.

---

## 2. Variables de Entorno Obligatorias

El servidor valida todas las variables críticas al iniciar (`backend/config/entorno.ts`). **Si falta alguna o no cumple el formato requerido, el proceso aborta inmediatamente con código de salida `1`.**

### 2.1 Backend (`backend/.env` basado en `backend/.env.example`)

| Variable | Obligatoria | Regla de validación | Descripción |
|---|---|---|---|
| `NODE_ENV` | Sí | `development` \| `production` | Activa validaciones estrictas de SMTP, CORS y HSTS en `production`. |
| `PORT` | Opcional | Entero `1`–`65535` (defecto `3000`) | Puerto local donde escucha Express. |
| `JWT_SECRET` | **Sí** | **Mínimo 32 caracteres** | Secreto criptográfico para firmar JWT. Generar con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. |
| `DB_HOST` | **Sí** | No vacío | Host del servidor PostgreSQL. |
| `DB_PORT` | **Sí** | Entero `1`–`65535` | Puerto de PostgreSQL (habitualmente `5432`). |
| `DB_USER` | **Sí** | No vacío | Usuario de base de datos. |
| `DB_PASSWORD` | **Sí** | No vacío | Contraseña de base de datos. |
| `DB_DATABASE` | **Sí** | No vacío | Nombre de la base de datos (`fyag_db`; `postgres` en Supabase). |
| `APLICAR_MIGRACIONES` | Opcional | `false` para omitir | Con `false` no se ejecutan los scripts de `backend/migraciones/` al arrancar. Recomendado en Supabase (ver sección 1.3). |
| `CORS_ORIGIN` | **Sí (Prod)** | Orígenes `http://` o `https://` separados por coma, sin rutas ni credenciales | Lista blanca explícita de orígenes web permitidos (ej. `https://app.fyag.cl`). |
| `SMTP_HOST` | **Sí (Prod)** | No vacío en producción | Servidor SMTP para envío de OC, alertas y recuperación de clave. |
| `SMTP_PORT` | **Sí (Prod)** | Entero `1`–`65535` (`587` o `465`) | Puerto SMTP. |
| `SMTP_USER` | **Sí (Prod)** | No vacío en producción | Usuario SMTP. |
| `SMTP_PASS` | **Sí (Prod)** | No vacío en producción | Contraseña o API Key SMTP. |
| `SMTP_FROM` | Recomendado | Correo remitente | Ej. `FYAG <no-responder@fyag.cl>`. |
| `URL_RESTABLECER_CLAVE` | Recomendado | URL HTTPS pública | Ej. `https://app.fyag.cl/restablecer-clave`. |

### 2.2 Frontend (`frontend/.env` basado en `frontend/.env.example`)

| Variable | Obligatoria | Descripción |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | **Sí** | URL base de la API. En producción **debe** usar `https://` y un nombre de dominio público (ej. `https://api.fyag.cl/api`), nunca IPs locales. |
| `EXPO_PUBLIC_PERMITIR_MOCK` | No (`false`) | Mantener en `false`. En producción el fallback simulado está bloqueado por código aunque esta variable exista. |

> **Importante:** Nunca versionar archivos `.env` reales en Git. Solo se versionan `backend/.env.example` y `frontend/.env.example`.

---

## 3. Certificado HTTPS y Proxy Inverso en Producción

El backend Express escucha en `127.0.0.1:3000` (o en la red interna del contenedor) detrás de un proxy inverso que termina TLS/HTTPS y reenvía `X-Forwarded-For` para el rate limiting por IP.

### Ejemplo con Caddy (certificado Let's Encrypt automático)

```caddyfile
api.fyag.cl {
    reverse_proxy 127.0.0.1:3000
}
```

### Ejemplo con Nginx + Certbot

```nginx
server {
    listen 443 ssl http2;
    server_name api.fyag.cl;

    ssl_certificate     /etc/letsencrypt/live/api.fyag.cl/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.fyag.cl/privkey.pem;

    # Permitir lotes de sincronización con fotos Base64 (hasta 60 MB)
    client_max_body_size 60M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. Compilación y Ejecución (Backend, Web, Android e iOS)

### 4.1 Backend
```powershell
cd backend
npm ci
npm run typecheck
npm test
npm run build
npm start
```

### 4.2 Frontend Web (Expo Web)
```powershell
cd frontend
npm ci
npm run typecheck
# Desarrollo
npm run web
# Exportación estática de producción (genera carpeta dist/)
npx expo export --platform web
```

### 4.3 Android e iOS
* **Desarrollo en dispositivo físico / emulador:**
  ```powershell
  cd frontend
  npm run android   # Android
  npm run ios       # iOS (macOS)
  ```
* **Build de producción con EAS Build:**
  Definir `EXPO_PUBLIC_API_URL=https://api.fyag.cl/api` en el perfil `production` de `eas.json` o en los secretos de EAS y ejecutar:
  ```powershell
  npx eas-cli build --platform all --profile production
  ```

---

## 5. Procedimiento de Respaldo y Restauración (RPO 24 h / RTO 4 h)

El sistema cuenta con un monitor diario de respaldos (`backend/controllers/respaldoController.ts` y migración `020_monitor_respaldos.sql`) que se ejecuta automáticamente a las **02:00 h** (horario de baja actividad):

1. **Objetivos operativos (configurables en `parametro_sistema`):**
   * `horas_max_perdida_datos` (RPO): **24 horas**.
   * `horas_max_recuperacion` (RTO): **4 horas (240 minutos)**.
   * `dias_retencion_respaldos`: **30 días**.
   * `dias_prueba_restauracion`: **90 días (trimestral)**.
2. **Generación de respaldo cifrado (`pg_dump` + AES-256 + subida a nube):**
   ```bash
   pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" \
     | openssl enc -aes-256-cbc -salt -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY \
     > "fyag_$(date -u +%Y%m%dT%H%M%SZ).dump.enc"
   ```
   Si la ejecución falla o el archivo no queda cifrado, el monitor registra `estado = 'fallo'` en `respaldos_ejecucion` y dispara de inmediato la alerta roja `respaldo_fallido` en el sistema y por correo al Administrador.
3. **Ejecución manual y monitoreo desde la API (solo Administrador):**
   * `GET /api/respaldos`: historial de ejecuciones y estado de salud de RPO y pruebas trimestrales.
   * `POST /api/respaldos/ejecutar`: dispara un respaldo monitoreado inmediato.
4. **Restauración y documentación trimestral obligatoria:**
   * Para restaurar un respaldo cifrado en una instancia limpia:
     ```bash
     openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY -in fyag_respaldo.dump.enc \
       | pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL"
     ```
   * Una vez verificada la restauración, documentar el resultado y el tiempo empleado en `POST /api/respaldos/pruebas-restauracion`:
     ```json
     {
       "fecha_prueba": "2026-11-26",
       "id_respaldo": 12,
       "resultado": "exitosa",
       "tiempo_recuperacion_min": 45,
       "observaciones": "Restauración completa verificada en entorno staging"
     }
     ```
   * El sistema calcula automáticamente `cumple_rto` (`tiempo_recuperacion_min <= 240`) y deja constancia en `bitacora_auditoria`.
