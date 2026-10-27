# Guía de entrega — Saber Hacer Unidad 3

## Requisitos de la actividad

- Aplicación web funcionando.
- Mecanismos de seguridad demostrados.
- Web Service de terceros demostrado.
- Web Services propios probados.
- Enlace del repositorio funcional.
- PDF con portada, introducción y conclusión de al menos media cuartilla, capturas, descripción técnica y referencias APA.
- Repositorio con código completo, historial de trabajo y acceso para el docente.

## Capturas que debes obtener después de ejecutar el proyecto

1. Página principal con el catálogo cargado.
2. Registro de una cuenta de prueba.
3. Inicio de sesión correcto.
4. Inicio de sesión incorrecto.
5. Carrito solicitado sin sesión y respuesta `401`.
6. `GET /api/health`.
7. `GET /api/products`.
8. Correo enviado mediante SMTP real, si configuraste proveedor externo.
9. Panel de variables de entorno con los valores ocultos.
10. Logs del despliegue en Render.
11. Repositorio GitHub y commits.

## Checklist previo a entregar

- [ ] El archivo `.env` no está en GitHub.
- [ ] `sql/schema.sql` se ejecutó sobre la base de datos correcta.
- [ ] `npm test` termina sin errores.
- [ ] `/api/health` responde correctamente.
- [ ] El catálogo carga datos desde PostgreSQL.
- [ ] Registro, inicio de sesión, cierre de sesión y carrito fueron probados.
- [ ] El proveedor SMTP fue configurado y probado, o se declara que no se habilitó.
- [ ] El repositorio tiene el nombre requerido por el docente.
- [ ] El docente tiene acceso al repositorio si es privado.
- [ ] El PDF incluye las capturas reales y la URL pública de Render.
