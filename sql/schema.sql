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

ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(40) NOT NULL DEFAULT 'General';

CREATE TABLE IF NOT EXISTS cart_items (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'confirmado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0)
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

INSERT INTO products (name, description, price, image, stock)
SELECT v.name, v.description, v.price, v.image, v.stock
FROM (VALUES
 ('Bocina portátil', 'Bocina compacta con buen volumen y batería para todo el día.', 459.00, 'speaker', 14),
 ('Cuaderno de apuntes', 'Cuaderno de pasta dura con hojas punteadas para tus ideas.', 99.00, 'notebook', 40),
 ('Batería portátil', 'Carga tu teléfono y tus accesorios en cualquier lugar.', 399.00, 'charger', 9),
 ('Cámara web HD', 'Cámara para clases y reuniones con imagen nítida.', 529.00, 'webcam', 7)
) AS v(name, description, price, image, stock)
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.name = v.name);

UPDATE products SET category = CASE image
  WHEN 'headphones' THEN 'Audio'
  WHEN 'speaker' THEN 'Audio'
  WHEN 'keyboard' THEN 'Computación'
  WHEN 'mouse' THEN 'Computación'
  WHEN 'webcam' THEN 'Computación'
  WHEN 'charger' THEN 'Computación'
  WHEN 'lamp' THEN 'Escritorio'
  WHEN 'notebook' THEN 'Escritorio'
  ELSE 'Accesorios'
END
WHERE category = 'General';
