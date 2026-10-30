# Tienda Digital — Saber Hacer Unidad 3

Aplicación web académica de comercio electrónico desarrollada con Node.js, Express y PostgreSQL. Incluye catálogo, registro e inicio de sesión, carrito asociado a la cuenta, validaciones, medidas de seguridad y un servicio SMTP opcional para el formulario de contacto.

## Funciones

- Catálogo de productos desde PostgreSQL con búsqueda, filtros por categoría y ordenamiento.
- Detalle de producto con productos relacionados.
- Favoritos guardados por usuario.
- Registro e inicio de sesión con contraseñas almacenadas mediante bcrypt.
- Sesiones con cookies `HttpOnly`, `SameSite=Lax` y `Secure` en producción.
- Carrito guardado en la base de datos con cantidades editables, envío calculado y opción de vaciarlo.
- Confirmación de pedidos (simulada, sin pagos) con descuento de existencias en una transacción.
- Historial de pedidos por usuario.
- API propia con rutas `/api/...`.
- Cabeceras de seguridad con Helmet y limitación de solicitudes en rutas de API/autenticación.
- Servicio externo SMTP opcional (para habilitarlo se requieren credenciales propias).
- Pruebas automatizadas básicas con Node Test Runner.

> Este proyecto es una base académica. No procesa pagos ni debe usarse en producción sin revisión de seguridad, monitoreo, políticas de privacidad y pruebas adicionales.

## Requisitos

- Node.js 20 o posterior
- PostgreSQL 14 o posterior (local o administrado)
- Git

## Ejecutar localmente

1. Clona el repositorio y entra a la carpeta:
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd camachodiazmiguelarmandounidad3
   ```
2. Instala dependencias:
   ```bash
   npm install
   ```
3. Copia `.env.example` como `.env` y configura la conexión:
   ```bash
   cp .env.example .env
   ```
   En Windows también puedes copiar el archivo desde el Explorador. Define un `SESSION_SECRET` largo y aleatorio.
4. Crea una base de datos llamada `tienda_digital`.
5. Ejecuta el esquema y los datos de ejemplo (puedes volver a ejecutarlo en una base existente para agregar las tablas y columnas nuevas):
   ```bash
   psql -U postgres -d tienda_digital -f sql/schema.sql
   ```
6. Inicia la aplicación:
   ```bash
   npm start
   ```
7. Abre `http://localhost:3000`.

## API propia

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/api/health` | Estado básico del servicio | Público |
| GET | `/api/products` | Lista de productos activos | Público |
| GET | `/api/products/:id` | Consulta un producto | Público |
| POST | `/api/auth/register` | Registra una cuenta | Público, limitado |
| POST | `/api/auth/login` | Inicia sesión | Público, limitado |
| POST | `/api/auth/logout` | Cierra sesión | Sesión |
| GET | `/api/auth/me` | Consulta la cuenta actual | Sesión |
| GET | `/api/cart` | Consulta el carrito del usuario | Sesión |
| POST | `/api/cart` | Agrega producto al carrito | Sesión |
| PUT | `/api/cart/:productId` | Cambia la cantidad de un producto | Sesión |
| DELETE | `/api/cart/:productId` | Quita un producto del carrito | Sesión |
| DELETE | `/api/cart` | Vacía el carrito | Sesión |
| GET | `/api/favorites` | Lista los ids de productos favoritos | Sesión |
| POST | `/api/favorites/:productId` | Agrega un favorito | Sesión |
| DELETE | `/api/favorites/:productId` | Quita un favorito | Sesión |
| POST | `/api/orders` | Confirma el carrito como pedido | Sesión |
| GET | `/api/orders` | Historial de pedidos | Sesión |
| POST | `/api/contact` | Envía mensaje mediante SMTP | Público, requiere SMTP configurado |

### Ejemplos de prueba

Comprobar el estado:
```bash
curl http://localhost:3000/api/health
```

Consultar el catálogo:
```bash
curl http://localhost:3000/api/products
```

Registrar cuenta (guarda la cookie de sesión en `cookies.txt`):
```bash
curl -i -c cookies.txt -H "Content-Type: application/json" \
  -d '{"name":"Usuario Demo","email":"demo@example.com","password":"ClaveDemo12345"}' \
  http://localhost:3000/api/auth/register
```

Consultar el carrito usando la cookie:
```bash
curl -b cookies.txt http://localhost:3000/api/cart
```

## Seguridad

- Contraseñas con bcrypt (factor 12).
- Consultas SQL parametrizadas.
- Validación del lado del servidor y límites de tamaño del cuerpo.
- Helmet con Content Security Policy y cabeceras de seguridad.
- Limitación de intentos de autenticación y solicitudes generales.
- Regeneración de sesión al autenticar y destrucción al cerrar sesión.
- Cookies `HttpOnly` y `SameSite`; `Secure` en producción.
- Variables de entorno; `.env` está excluido de Git.
- No se almacenan datos de tarjetas ni se procesan pagos.

## Servicio de terceros

El formulario de contacto puede enviar correo por SMTP usando Nodemailer. Para activarlo, configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM en las variables de entorno del despliegue. Sin estas variables, la API devuelve `503` e informa que el servicio no está configurado. Usa un proveedor al que tengas acceso y nunca subas las credenciales al repositorio.

## Despliegue en Render

1. Sube este proyecto a GitHub.
2. Crea una base de datos PostgreSQL en Render y ejecuta `sql/schema.sql` sobre esa base.
3. Crea un Web Service desde el repositorio.
4. Build command: `npm install`
5. Start command: `npm start`
6. Agrega las variables `NODE_ENV=production`, `DATABASE_URL` (cadena interna de PostgreSQL), `DB_SSL=true` si tu conexión requiere SSL, `SESSION_SECRET` (secreto fuerte) y `APP_URL` (URL pública).
7. Agrega variables SMTP solo si vas a demostrar el envío de correo.
8. Despliega y verifica `/api/health`, el catálogo, el registro, inicio/cierre de sesión y carrito.

**Importante:** no uses el nombre de usuario `postgres` si Render te asigna otro usuario. Copia los valores desde la información de conexión de la base de datos y no publiques la cadena `DATABASE_URL`.

## Evidencias para la actividad

Toma capturas reales del sitio y agrégalas al reporte:
1. Página principal y catálogo.
2. Registro e inicio de sesión.
3. Prueba de credenciales incorrectas.
4. Acceso denegado al carrito sin sesión (respuesta 401).
5. API `/api/health` y `/api/products`.
6. Formulario de contacto: correo recibido mediante SMTP, con datos personales ocultos.
7. Variables de entorno de Render, ocultando valores sensibles.
8. Logs del despliegue y conexión a PostgreSQL.
9. Repositorio GitHub con historial de commits.

No uses capturas simuladas ni afirmes que una prueba pasó si no la ejecutaste. Invita al docente como colaborador si el repositorio es privado.

## Pruebas

Ejecutar:
```bash
npm test
```

## Estructura

```text
public/           Interfaz web y JavaScript del navegador
sql/schema.sql    Tablas y datos de ejemplo
test/             Pruebas automatizadas
server.js         Servidor Express y API
.env.example      Plantilla de variables, sin secretos
```

## Referencias

- Express. (s. f.). *Express documentation*. https://expressjs.com/
- GitHub. (s. f.). *About repositories*. https://docs.github.com/en/repositories
- Node.js. (s. f.). *Node.js documentation*. https://nodejs.org/docs/latest/api/
- OWASP Foundation. (s. f.). *OWASP Cheat Sheet Series*. https://cheatsheetseries.owasp.org/
- PostgreSQL Global Development Group. (s. f.). *PostgreSQL documentation*. https://www.postgresql.org/docs/
- Render. (s. f.). *PostgreSQL and web services documentation*. https://render.com/docs
