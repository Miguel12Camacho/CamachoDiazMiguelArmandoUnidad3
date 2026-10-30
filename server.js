require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const nodemailer = require("nodemailer");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";
const FREE_SHIPPING_FROM = 999;
const SHIPPING_COST = 79;

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  }
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined }
  : {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || "tienda_digital",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "",
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
    };
const pool = new Pool(poolConfig);

const sessionConfig = {
  name: "tienda.sid",
  secret: process.env.SESSION_SECRET || "solo-desarrollo-cambia-este-secreto",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 2
  }
};
if (isProduction) {
  sessionConfig.store = require("connect-pg-simple")(session)({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true
  });
}
app.use(session(sessionConfig));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: "draft-7", legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false });

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Debes iniciar sesión para realizar esta acción." });
  next();
}
function validEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}
function calculateShipping(subtotal) {
  return subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_COST;
}
function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "tienda-digital", timestamp: new Date().toISOString() }));

app.get("/api/products", apiLimiter, asyncRoute(async (req, res) => {
  const result = await pool.query("SELECT id, name, description, price, image, stock, category FROM products WHERE active = TRUE ORDER BY id");
  res.json({ data: result.rows });
}));

app.get("/api/products/:id", apiLimiter, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Identificador inválido." });
  const result = await pool.query("SELECT id, name, description, price, image, stock, category FROM products WHERE id = $1 AND active = TRUE", [id]);
  if (!result.rowCount) return res.status(404).json({ error: "Producto no encontrado." });
  res.json({ data: result.rows[0] });
}));

app.post("/api/auth/register", authLimiter, asyncRoute(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: "El nombre debe tener entre 2 y 80 caracteres." });
  if (!validEmail(email)) return res.status(400).json({ error: "Correo electrónico inválido." });
  if (password.length < 10 || password.length > 72) return res.status(400).json({ error: "La contraseña debe tener entre 10 y 72 caracteres." });
  const hash = await bcrypt.hash(password, 12);
  try {
    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hash]
    );
    req.session.regenerate(err => {
      if (err) return res.status(500).json({ error: "No fue posible crear la sesión." });
      req.session.user = publicUser(result.rows[0]);
      req.session.save(saveErr => {
        if (saveErr) return res.status(500).json({ error: "No fue posible guardar la sesión." });
        res.status(201).json({ message: "Cuenta creada correctamente.", user: publicUser(result.rows[0]) });
      });
    });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
    throw error;
  }
}));

app.post("/api/auth/login", authLimiter, asyncRoute(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!validEmail(email) || !password) return res.status(400).json({ error: "Ingresa un correo y contraseña válidos." });
  const result = await pool.query("SELECT id, name, email, password_hash FROM users WHERE email = $1", [email]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: "Correo o contraseña incorrectos." });
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: "No fue posible crear la sesión." });
    req.session.user = publicUser(user);
    req.session.save(saveErr => {
      if (saveErr) return res.status(500).json({ error: "No fue posible guardar la sesión." });
      res.json({ message: "Sesión iniciada.", user: publicUser(user) });
    });
  });
}));

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: "No fue posible cerrar la sesión." });
    res.clearCookie("tienda.sid", { httpOnly: true, sameSite: "lax", secure: isProduction });
    res.json({ message: "Sesión cerrada." });
  });
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "No has iniciado sesión." });
  res.json({ user: req.session.user });
});

app.get("/api/cart", requireAuth, asyncRoute(async (req, res) => {
  const result = await pool.query(
    `SELECT c.product_id, p.name, p.price, p.image, p.stock, c.quantity,
            (p.price * c.quantity)::numeric(12,2) AS subtotal
     FROM cart_items c JOIN products p ON p.id = c.product_id
     WHERE c.user_id = $1 ORDER BY p.name`,
    [req.session.user.id]
  );
  res.json({ data: result.rows });
}));

app.post("/api/cart", requireAuth, asyncRoute(async (req, res) => {
  const productId = Number(req.body.productId);
  const quantity = Number(req.body.quantity || 1);
  if (!Number.isInteger(productId) || productId < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    return res.status(400).json({ error: "Producto o cantidad inválidos." });
  }
  const product = await pool.query("SELECT id, stock FROM products WHERE id = $1 AND active = TRUE", [productId]);
  if (!product.rowCount) return res.status(404).json({ error: "Producto no encontrado." });
  if (quantity > product.rows[0].stock) return res.status(409).json({ error: "No hay existencias suficientes." });
  await pool.query(
    `INSERT INTO cart_items (user_id, product_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, product_id)
     DO UPDATE SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, 20)`,
    [req.session.user.id, productId, quantity]
  );
  res.status(201).json({ message: "Producto agregado al carrito." });
}));

app.delete("/api/cart/:productId", requireAuth, asyncRoute(async (req, res) => {
  const productId = Number(req.params.productId);
  if (!Number.isInteger(productId) || productId < 1) return res.status(400).json({ error: "Identificador inválido." });
  await pool.query("DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2", [req.session.user.id, productId]);
  res.json({ message: "Producto eliminado del carrito." });
}));

app.put("/api/cart/:productId", requireAuth, asyncRoute(async (req, res) => {
  const productId = Number(req.params.productId);
  const quantity = Number(req.body.quantity);
  if (!Number.isInteger(productId) || productId < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    return res.status(400).json({ error: "Producto o cantidad inválidos." });
  }
  const product = await pool.query("SELECT stock FROM products WHERE id = $1 AND active = TRUE", [productId]);
  if (!product.rowCount) return res.status(404).json({ error: "Producto no encontrado." });
  if (quantity > product.rows[0].stock) return res.status(409).json({ error: "No hay existencias suficientes." });
  const result = await pool.query(
    "UPDATE cart_items SET quantity = $1 WHERE user_id = $2 AND product_id = $3",
    [quantity, req.session.user.id, productId]
  );
  if (!result.rowCount) return res.status(404).json({ error: "El producto no está en tu carrito." });
  res.json({ message: "Cantidad actualizada." });
}));

app.delete("/api/cart", requireAuth, asyncRoute(async (req, res) => {
  await pool.query("DELETE FROM cart_items WHERE user_id = $1", [req.session.user.id]);
  res.json({ message: "Carrito vaciado." });
}));

app.get("/api/favorites", requireAuth, asyncRoute(async (req, res) => {
  const result = await pool.query("SELECT product_id FROM favorites WHERE user_id = $1 ORDER BY created_at DESC", [req.session.user.id]);
  res.json({ data: result.rows.map(row => Number(row.product_id)) });
}));

app.post("/api/favorites/:productId", requireAuth, asyncRoute(async (req, res) => {
  const productId = Number(req.params.productId);
  if (!Number.isInteger(productId) || productId < 1) return res.status(400).json({ error: "Identificador inválido." });
  const product = await pool.query("SELECT id FROM products WHERE id = $1 AND active = TRUE", [productId]);
  if (!product.rowCount) return res.status(404).json({ error: "Producto no encontrado." });
  await pool.query(
    "INSERT INTO favorites (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [req.session.user.id, productId]
  );
  res.status(201).json({ message: "Agregado a favoritos." });
}));

app.delete("/api/favorites/:productId", requireAuth, asyncRoute(async (req, res) => {
  const productId = Number(req.params.productId);
  if (!Number.isInteger(productId) || productId < 1) return res.status(400).json({ error: "Identificador inválido." });
  await pool.query("DELETE FROM favorites WHERE user_id = $1 AND product_id = $2", [req.session.user.id, productId]);
  res.json({ message: "Quitado de favoritos." });
}));

app.post("/api/orders", requireAuth, asyncRoute(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cart = await client.query(
      `SELECT c.product_id, c.quantity, p.name, p.price, p.stock
       FROM cart_items c JOIN products p ON p.id = c.product_id
       WHERE c.user_id = $1 AND p.active = TRUE
       ORDER BY p.id FOR UPDATE OF p`,
      [req.session.user.id]
    );
    if (!cart.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Tu carrito está vacío." });
    }
    const unavailable = cart.rows.find(item => item.quantity > item.stock);
    if (unavailable) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: `No hay existencias suficientes de ${unavailable.name}.` });
    }
    const subtotal = cart.rows.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
    const total = subtotal + calculateShipping(subtotal);
    const order = await client.query(
      "INSERT INTO orders (user_id, total) VALUES ($1, $2) RETURNING id, total, status, created_at",
      [req.session.user.id, total.toFixed(2)]
    );
    for (const item of cart.rows) {
      await client.query(
        "INSERT INTO order_items (order_id, product_id, name, price, quantity) VALUES ($1, $2, $3, $4, $5)",
        [order.rows[0].id, item.product_id, item.name, item.price, item.quantity]
      );
      await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [item.quantity, item.product_id]);
    }
    await client.query("DELETE FROM cart_items WHERE user_id = $1", [req.session.user.id]);
    await client.query("COMMIT");
    res.status(201).json({ message: "Pedido confirmado.", order: order.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.get("/api/orders", requireAuth, asyncRoute(async (req, res) => {
  const result = await pool.query(
    `SELECT o.id, o.total, o.status, o.created_at,
            COALESCE(json_agg(json_build_object('name', i.name, 'price', i.price, 'quantity', i.quantity) ORDER BY i.id)
                     FILTER (WHERE i.id IS NOT NULL), '[]') AS items
     FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
     WHERE o.user_id = $1
     GROUP BY o.id ORDER BY o.created_at DESC LIMIT 20`,
    [req.session.user.id]
  );
  res.json({ data: result.rows });
}));

app.post("/api/contact", apiLimiter, asyncRoute(async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 80);
  const email = String(req.body.email || "").trim();
  const message = String(req.body.message || "").trim().slice(0, 2000);
  if (name.length < 2 || !validEmail(email) || message.length < 5) {
    return res.status(400).json({ error: "Completa nombre, correo válido y un mensaje de al menos 5 caracteres." });
  }
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(503).json({ error: "El servicio de correo no está configurado. Agrega las variables SMTP para habilitarlo." });
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.SMTP_USER,
    replyTo: email,
    subject: `Mensaje de Tienda Digital: ${name}`,
    text: `Nombre: ${name}\nCorreo: ${email}\n\n${message}`
  });
  res.json({ message: "Mensaje enviado correctamente mediante el servicio de correo." });
}));

app.use("/api", (req, res) => res.status(404).json({ error: "Ruta de API no encontrada." }));
app.use((err, req, res, next) => {
  console.error("Error de servidor:", err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Ocurrió un error interno. Intenta más tarde." });
});

async function start() {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Conexión a PostgreSQL establecida");
  } catch (err) {
    console.error("❌ No se pudo conectar a PostgreSQL:", err.message);
    if (isProduction) process.exit(1);
    console.log("ℹ️ El servidor iniciará, pero las funciones que requieren base de datos fallarán hasta configurarla.");
  }
  app.listen(PORT, () => console.log(`🚀 Tienda Digital disponible en http://localhost:${PORT}`));
}
if (require.main === module) start();

module.exports = { app, pool, validEmail, calculateShipping };
