const $ = (selector) => document.querySelector(selector);
const state = { products: [], mode: "login", cart: [], user: null, toastTimer: null, sort: "featured", query: "" };

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
function setCartCount(n) {
  const el = $("#cart-count");
  const changed = el.textContent !== String(n);
  el.textContent = n;
  if (changed) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
}
function setStatus(selector, message, isError = false) {
  const el = $(selector);
  el.textContent = message;
  el.classList.toggle("error", isError);
}
const knownIcons = ["headphones", "backpack", "keyboard", "bottle", "lamp", "mouse"];
function iconSvg(type) {
  const id = knownIcons.includes(type) ? type : "product";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#ic-${id}`);
  svg.append(use);
  return svg;
}
function showSkeleton() {
  const grid = $("#product-grid");
  grid.setAttribute("aria-busy", "true");
  grid.innerHTML = Array.from({ length: 6 }, () =>
    '<article class="product-card skeleton"><div class="product-art"></div><div class="product-info"><div class="line w60"></div><div class="line w90"></div><div class="line w60"></div></div></article>'
  ).join("");
}
function visibleProducts() {
  const q = state.query;
  let list = q ? state.products.filter(p => `${p.name} ${p.description}`.toLocaleLowerCase("es-MX").includes(q)) : [...state.products];
  if (state.sort === "price-asc") list.sort((a, b) => Number(a.price) - Number(b.price));
  else if (state.sort === "price-desc") list.sort((a, b) => Number(b.price) - Number(a.price));
  else if (state.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "es-MX"));
  return list;
}
function refreshCatalog() {
  const list = visibleProducts();
  renderProducts(list);
  $("#catalog-status").textContent = state.query ? `${list.length} resultado(s)` : `${state.products.length} productos`;
}

function renderProducts(products) {
  const grid = $("#product-grid");
  grid.replaceChildren();
  grid.setAttribute("aria-busy", "false");
  if (!products.length) {
    grid.innerHTML = '<div class="empty-state"><strong>No encontramos productos</strong>Prueba con otra palabra o limpia la búsqueda.</div>';
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
    const stock = Number(product.stock);
    if (stock <= 0) { tag.classList.add("out"); tag.textContent = "Agotado"; }
    else if (stock <= 12) { tag.classList.add("low"); tag.textContent = `Quedan ${stock}`; }
    else tag.textContent = "Disponible";
    const shape = document.createElement("div");
    shape.className = "shape";
    shape.setAttribute("aria-hidden", "true");
    shape.append(iconSvg(product.image));
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
    button.textContent = Number(product.stock) > 0 ? "Agregar" : "Agotado";
    button.setAttribute("aria-label", `Agregar ${product.name} al carrito`);
    button.disabled = Number(product.stock) <= 0;
    button.addEventListener("click", () => addToCart(product.id));
    bottom.append(price, button);
    info.append(title, description, bottom);
    card.append(art, info);
    grid.append(card);
  }
}
async function loadProducts() {
  showSkeleton();
  try {
    const result = await request("/api/products");
    state.products = result.data;
    refreshCatalog();
  } catch (error) {
    $("#product-grid").replaceChildren();
    $("#product-grid").setAttribute("aria-busy", "false");
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
    $("#signed-avatar").textContent = (state.user.name || "?").trim().charAt(0).toUpperCase();
  }
  $("#account-label").textContent = state.user ? state.user.name.split(" ")[0] : "Mi cuenta";
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
  if (!state.user) { setCartCount(0); return; }
  try {
    const result = await request("/api/cart");
    state.cart = result.data;
    setCartCount(state.cart.reduce((sum, item) => sum + Number(item.quantity), 0));
  } catch { setCartCount(0); }
}
function emptyCart(title, text, withButton) {
  const box = document.createElement("div");
  box.className = "cart-empty";
  const strong = document.createElement("strong");
  strong.textContent = title;
  box.append(strong, text);
  if (withButton) {
    const link = document.createElement("a");
    link.className = "btn btn-primary";
    link.href = "#catalogo";
    link.textContent = "Explorar productos";
    link.addEventListener("click", () => $("#cart-dialog").close());
    box.append(link);
  }
  return box;
}
async function renderCart() {
  const target = $("#cart-content");
  target.replaceChildren();
  if (!state.user) {
    const box = emptyCart("Inicia sesión", "Entra a tu cuenta para consultar tu carrito.", false);
    const login = document.createElement("button");
    login.className = "btn btn-primary";
    login.type = "button";
    login.textContent = "Iniciar sesión";
    login.addEventListener("click", () => { $("#cart-dialog").close(); $("#account-dialog").showModal(); });
    box.append(login);
    target.append(box);
    return;
  }
  try {
    const result = await request("/api/cart");
    state.cart = result.data;
    setCartCount(state.cart.reduce((sum, item) => sum + Number(item.quantity), 0));
    if (!state.cart.length) {
      target.append(emptyCart("Tu carrito está vacío", "Explora el catálogo para agregar productos.", true));
      return;
    }
    let total = 0;
    for (const item of state.cart) {
      total += Number(item.subtotal);
      const row = document.createElement("div");
      row.className = "cart-row";
      const thumb = document.createElement("div");
      thumb.className = "cart-thumb";
      const known = state.products.find(p => Number(p.id) === Number(item.product_id));
      thumb.append(iconSvg(known && known.image));
      const name = document.createElement("div");
      name.className = "cart-name";
      name.textContent = item.name;
      const details = document.createElement("small");
      details.textContent = `${item.quantity} × ${money(item.price)}`;
      name.append(details);
      const lineTotal = document.createElement("strong");
      lineTotal.className = "line-total";
      lineTotal.textContent = money(item.subtotal);
      const remove = document.createElement("button");
      remove.className = "remove-item";
      remove.type = "button";
      remove.textContent = "Quitar";
      remove.setAttribute("aria-label", `Quitar ${item.name}`);
      remove.addEventListener("click", async () => {
        try {
          await request(`/api/cart/${item.product_id}`, { method: "DELETE" });
          await renderCart();
        } catch (error) { setStatus("#cart-status", error.message, true); }
      });
      row.append(thumb, name, lineTotal, remove);
      target.append(row);
    }
    const totalRow = document.createElement("div");
    totalRow.className = "cart-total";
    const label = document.createElement("span");
    label.textContent = "Total estimado";
    const value = document.createElement("span");
    value.textContent = money(total);
    totalRow.append(label, value);
    const note = document.createElement("p");
    note.className = "cart-note";
    note.textContent = "Esta tienda es un proyecto académico y no procesa pagos.";
    target.append(totalRow, note);
  } catch (error) { target.textContent = error.message; }
}
async function openCart() {
  $("#cart-dialog").showModal();
  setStatus("#cart-status", "");
  await renderCart();
}
$("#account-open").addEventListener("click", () => $("#account-dialog").showModal());
$("#cart-open").addEventListener("click", openCart);
document.querySelectorAll("[data-open]").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll("dialog[open]").forEach(d => d.close());
  if (button.dataset.open === "cart-dialog") openCart(); else $("#account-dialog").showModal();
}));
document.querySelectorAll("dialog.modal").forEach(dialog => dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
}));
$("#toggle-pass").addEventListener("click", () => {
  const input = $("#password-input");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  $("#toggle-pass").textContent = show ? "Ocultar" : "Mostrar";
  $("#toggle-pass").setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
});
$("#sort-select").addEventListener("change", event => { state.sort = event.target.value; refreshCatalog(); });
$("#search-input").addEventListener("input", event => {
  if (!event.target.value.trim() && state.query) { state.query = ""; refreshCatalog(); }
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
  state.query = $("#search-input").value.trim().toLocaleLowerCase("es-MX");
  refreshCatalog();
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
