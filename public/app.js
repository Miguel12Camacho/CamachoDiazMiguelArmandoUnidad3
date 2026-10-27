const $ = (selector) => document.querySelector(selector);
const state = { products: [], mode: "login", cart: [], user: null, toastTimer: null };

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "No fue posible completar la solicitud.");
  return body;
}
function money(value) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value));
}
function notify(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
function setStatus(selector, message, isError = false) {
  const el = $(selector);
  el.textContent = message;
  el.classList.toggle("error", isError);
}
const productIcons = { headphones: "♫", backpack: "▱", keyboard: "⌨", bottle: "♧", lamp: "☼", mouse: "◖" };

function renderProducts(products) {
  const grid = $("#product-grid");
  grid.replaceChildren();
  if (!products.length) {
    grid.innerHTML = '<p class="muted">No se encontraron productos.</p>';
    return;
  }
  for (const product of products) {
    const card = document.createElement("article");
    card.className = "product-card";
    const art = document.createElement("div");
    art.className = "product-art";
    art.dataset.type = product.image || "product";
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = product.stock > 0 ? "DISPONIBLE" : "AGOTADO";
    const shape = document.createElement("div");
    shape.className = "shape";
    shape.setAttribute("aria-hidden", "true");
    shape.textContent = productIcons[product.image] || "✳";
    art.append(tag, shape);
    const info = document.createElement("div");
    info.className = "product-info";
    const title = document.createElement("h3");
    title.textContent = product.name;
    const description = document.createElement("p");
    description.textContent = product.description;
    const bottom = document.createElement("div");
    bottom.className = "product-bottom";
    const price = document.createElement("span");
    price.className = "price";
    price.textContent = money(product.price);
    const button = document.createElement("button");
    button.className = "add-button";
    button.textContent = "Agregar +";
    button.disabled = Number(product.stock) <= 0;
    button.addEventListener("click", () => addToCart(product.id));
    bottom.append(price, button);
    info.append(title, description, bottom);
    card.append(art, info);
    grid.append(card);
  }
}
async function loadProducts() {
  try {
    const result = await request("/api/products");
    state.products = result.data;
    renderProducts(state.products);
    $("#catalog-status").textContent = `${state.products.length} productos`;
  } catch (error) {
    $("#catalog-status").textContent = "Catálogo no disponible";
    $("#catalog-error").textContent = `${error.message} Revisa la conexión con PostgreSQL y ejecuta sql/schema.sql.`;
    $("#catalog-error").classList.remove("hidden");
  }
}
function showAuthMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.mode === mode));
  $("#name-field").classList.toggle("hidden", mode !== "register");
  $("#auth-form").elements.name.required = mode === "register";
  $("#auth-submit").textContent = mode === "register" ? "Crear cuenta" : "Iniciar sesión";
  $("#auth-form").elements.password.autocomplete = mode === "register" ? "new-password" : "current-password";
  setStatus("#auth-status", "");
}
function updateAccount() {
  $("#account-view").classList.toggle("hidden", Boolean(state.user));
  $("#account-signed").classList.toggle("hidden", !state.user);
  if (state.user) {
    $("#signed-name").textContent = state.user.name;
    $("#signed-email").textContent = state.user.email;
  }
}
async function checkSession() {
  try {
    const result = await request("/api/auth/me");
    state.user = result.user;
  } catch { state.user = null; }
  updateAccount();
  updateCartCount();
}
async function submitAuth(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = { email: form.get("email"), password: form.get("password") };
  if (state.mode === "register") payload.name = form.get("name");
  try {
    const result = await request(`/api/auth/${state.mode === "register" ? "register" : "login"}`, {
      method: "POST", body: JSON.stringify(payload)
    });
    state.user = result.user;
    updateAccount();
    $("#auth-form").reset();
    $("#account-dialog").close();
    notify(result.message);
    await updateCartCount();
  } catch (error) { setStatus("#auth-status", error.message, true); }
}
async function addToCart(productId) {
  if (!state.user) {
    $("#account-dialog").showModal();
    notify("Inicia sesión o crea una cuenta para usar el carrito.");
    return;
  }
  try {
    const result = await request("/api/cart", { method: "POST", body: JSON.stringify({ productId, quantity: 1 }) });
    notify(result.message);
    await updateCartCount();
  } catch (error) { notify(error.message); }
}
async function updateCartCount() {
  if (!state.user) { $("#cart-count").textContent = "0"; return; }
  try {
    const result = await request("/api/cart");
    state.cart = result.data;
    $("#cart-count").textContent = state.cart.reduce((sum, item) => sum + Number(item.quantity), 0);
  } catch { $("#cart-count").textContent = "0"; }
}
async function renderCart() {
  const target = $("#cart-content");
  target.replaceChildren();
  if (!state.user) {
    target.textContent = "Inicia sesión para consultar tu carrito.";
    return;
  }
  try {
    const result = await request("/api/cart");
    state.cart = result.data;
    $("#cart-count").textContent = state.cart.reduce((sum, item) => sum + Number(item.quantity), 0);
    if (!state.cart.length) {
      target.textContent = "Tu carrito está vacío. Explora el catálogo para agregar productos.";
      return;
    }
    let total = 0;
    for (const item of state.cart) {
      total += Number(item.subtotal);
      const row = document.createElement("div");
      row.className = "cart-row";
      const name = document.createElement("div");
      name.textContent = item.name;
      const details = document.createElement("small");
      details.textContent = `${item.quantity} × ${money(item.price)}`;
      name.append(details);
      const lineTotal = document.createElement("strong");
      lineTotal.className = "line-total";
      lineTotal.textContent = money(item.subtotal);
      const remove = document.createElement("button");
      remove.className = "remove-item";
      remove.textContent = "Quitar";
      remove.addEventListener("click", async () => {
        try {
          await request(`/api/cart/${item.product_id}`, { method: "DELETE" });
          await renderCart();
        } catch (error) { setStatus("#cart-status", error.message, true); }
      });
      row.append(name, lineTotal, remove);
      target.append(row);
    }
    const totalRow = document.createElement("div");
    totalRow.className = "cart-total";
    const label = document.createElement("span");
    label.textContent = "Total estimado";
    const value = document.createElement("span");
    value.textContent = money(total);
    totalRow.append(label, value);
    target.append(totalRow);
  } catch (error) { target.textContent = error.message; }
}
$("#account-open").addEventListener("click", () => $("#account-dialog").showModal());
$("#cart-open").addEventListener("click", async () => {
  $("#cart-dialog").showModal();
  setStatus("#cart-status", "");
  await renderCart();
});
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => $(`#${button.dataset.close}`).close()));
document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => showAuthMode(tab.dataset.mode)));
$("#auth-form").addEventListener("submit", submitAuth);
$("#logout-button").addEventListener("click", async () => {
  try {
    const result = await request("/api/auth/logout", { method: "POST", body: "{}" });
    state.user = null;
    state.cart = [];
    updateAccount();
    updateCartCount();
    setStatus("#logout-status", result.message);
  } catch (error) { setStatus("#logout-status", error.message, true); }
});
$("#search-form").addEventListener("submit", event => {
  event.preventDefault();
  const query = $("#search-input").value.trim().toLocaleLowerCase("es-MX");
  const filtered = state.products.filter(product => `${product.name} ${product.description}`.toLocaleLowerCase("es-MX").includes(query));
  renderProducts(query ? filtered : state.products);
  $("#catalog-status").textContent = query ? `${filtered.length} resultado(s)` : `${state.products.length} productos`;
  $("#catalogo").scrollIntoView({ behavior: "smooth" });
});
$("#contact-form").addEventListener("submit", async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const result = await request("/api/contact", { method: "POST", body: JSON.stringify(data) });
    setStatus("#contact-status", result.message);
    event.currentTarget.reset();
  } catch (error) { setStatus("#contact-status", error.message, true); }
});
showAuthMode("login");
loadProducts();
checkSession();
