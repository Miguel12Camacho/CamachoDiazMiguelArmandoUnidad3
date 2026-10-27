CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  image TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cart_items (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);

INSERT INTO products (name, description, price, image, stock)
SELECT v.name, v.description, v.price, v.image, v.stock
FROM (VALUES
 ('Audífonos inalámbricos', 'Sonido claro para estudiar, trabajar o escuchar música.', 499.00, 'headphones', 18),
 ('Mochila urbana', 'Mochila ligera con espacio para laptop y accesorios.', 649.00, 'backpack', 12),
 ('Teclado compacto', 'Teclado práctico para el escritorio de estudio.', 389.00, 'keyboard', 20),
 ('Botella reutilizable', 'Botella para mantener agua a la mano durante el día.', 179.00, 'bottle', 25),
 ('Lámpara de escritorio', 'Iluminación cómoda para leer y realizar tareas.', 329.00, 'lamp', 10),
 ('Mouse inalámbrico', 'Mouse compacto para uso cotidiano.', 249.00, 'mouse', 16)
) AS v(name, description, price, image, stock)
WHERE NOT EXISTS (SELECT 1 FROM products);
