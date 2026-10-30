const state = {
  products: [],
  cart: [],
  favorites: [],
  user: null,
  authMode: "login",
  category: "Todos",
  sort: "featured",
  query: "",
  toastTimer: null
};

const iconNames = ["headphones", "backpack", "keyboard", "bottle", "lamp", "mouse", "speaker", "notebook", "charger", "webcam"];
const lowStockLimit = 12;
const maxPerProduct = 20;
const freeShippingFrom = 999;
const shippingCost = 79;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value));
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

function iconMarkup(type) {
  const name = iconNames.includes(type) ? type : "product";
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><use href="#ic-${name}"/></svg>`;
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "No fue posible completar la solicitud.");
  }
  return body;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function setStatus(selector, message, isError = false) {
  const element = $(selector);
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function openDialog(id) {
  $$("dialog[open]").forEach(dialog => dialog.close());
  $(`#${id}`).showModal();
}

function closeDialog(id) {
  $(`#${id}`).close();
}

function getProduct(id) {
  return state.products.find(product => Number(product.id) === Number(id));
}

function isFavorite(id) {
  return state.favorites.includes(Number(id));
}

function getCartQuantity() {
  return state.cart.reduce((sum, item) => sum + Number(item.quantity), 0);
}

function getCartSubtotal() {
  return state.cart.reduce((sum, item) => sum + Number(item.subtotal), 0);
}

function updateCartBadge() {
  const badge = $("#cart-count");
  const quantity = String(getCartQuantity());
  if (badge.textContent !== quantity) {
    badge.textContent = quantity;
    badge.classList.remove("bump");
    void badge.offsetWidth;
    badge.classList.add("bump");
  }
}

function getCategories() {
  const names = [...new Set(state.products.map(product => product.category).filter(Boolean))];
  return ["Todos", ...names.sort((a, b) => a.localeCompare(b, "es-MX")), "Favoritos"];
}

function getVisibleProducts() {
  let list = [...state.products];

  if (state.category === "Favoritos") {
    list = list.filter(product => isFavorite(product.id));
  } else if (state.category !== "Todos") {
    list = list.filter(product => product.category === state.category);
  }

  if (state.query) {
    list = list.filter(product =>
      `${product.name} ${product.description} ${product.category}`.toLocaleLowerCase("es-MX").includes(state.query)
    );
  }

  const sorters = {
    "price-asc": (a, b) => Number(a.price) - Number(b.price),
    "price-desc": (a, b) => Number(b.price) - Number(a.price),
    name: (a, b) => a.name.localeCompare(b.name, "es-MX")
  };
  if (sorters[state.sort]) {
    list.sort(sorters[state.sort]);
  }
  return list;
}

function stockBadge(stock) {
  const quantity = Number(stock);
  if (quantity <= 0) return '<span class="tag out">Agotado</span>';
  if (quantity <= lowStockLimit) return `<span class="tag low">Quedan ${quantity}</span>`;
  return '<span class="tag">Disponible</span>';
}

function productCardMarkup(product) {
  const soldOut = Number(product.stock) <= 0;
  const favorite = isFavorite(product.id);
  return `
    <article class="product-card" data-id="${product.id}">
      <div class="product-art" data-type="${escapeHtml(product.image)}">
        ${stockBadge(product.stock)}
        <button class="fav-button ${favorite ? "active" : ""}" type="button" data-action="favorite" data-id="${product.id}"
          aria-pressed="${favorite}" aria-label="${favorite ? "Quitar de favoritos" : "Guardar en favoritos"}">
          <svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/></svg>
        </button>
        <button class="shape" type="button" data-action="details" data-id="${product.id}" aria-label="Ver detalles de ${escapeHtml(product.name)}">
          ${iconMarkup(product.image)}
        </button>
      </div>
      <div class="product-info">
        <span class="category-label">${escapeHtml(product.category)}</span>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.description)}</p>
        <div class="product-bottom">
          <span class="price">${formatMoney(product.price)}</span>
          <button class="add-button" type="button" data-action="add" data-id="${product.id}"
            ${soldOut ? "disabled" : ""} aria-label="Agregar ${escapeHtml(product.name)} al carrito">
            ${soldOut ? "Agotado" : "Agregar"}
          </button>
        </div>
      </div>
    </article>`;
}

function skeletonMarkup() {
  const card = `
    <article class="product-card skeleton">
      <div class="product-art"></div>
      <div class="product-info"><div class="line w60"></div><div class="line w90"></div><div class="line w60"></div></div>
    </article>`;
  return card.repeat(6);
}

function renderFilters() {
  $("#category-filters").innerHTML = getCategories().map(name => `
    <button class="chip ${name === state.category ? "active" : ""}" type="button" data-category="${escapeHtml(name)}"
      aria-pressed="${name === state.category}">${escapeHtml(name)}</button>
  `).join("");
}

function renderProducts() {
  const grid = $("#product-grid");
  const list = getVisibleProducts();
  grid.setAttribute("aria-busy", "false");

  if (!list.length) {
    const message = state.category === "Favoritos"
      ? "Aún no tienes favoritos. Toca el corazón de un producto para guardarlo."
      : "Prueba con otra palabra o cambia los filtros.";
    grid.innerHTML = `<div class="empty-state"><strong>No encontramos productos</strong>${message}</div>`;
  } else {
    grid.innerHTML = list.map(productCardMarkup).join("");
  }

  const filtering = state.query || state.category !== "Todos";
  $("#catalog-status").textContent = filtering ? `${list.length} resultado(s)` : `${state.products.length} productos`;
  renderFilters();
}

async function loadProducts() {
  $("#product-grid").innerHTML = skeletonMarkup();
  try {
    const result = await request("/api/products");
    state.products = result.data;
    $("#stat-products").textContent = state.products.length;
    renderProducts();
  } catch (error) {
    $("#product-grid").innerHTML = "";
    $("#product-grid").setAttribute("aria-busy", "false");
    $("#catalog-status").textContent = "Catálogo no disponible";
    const notice = $("#catalog-error");
    notice.textContent = `${error.message} Revisa la conexión con PostgreSQL y ejecuta sql/schema.sql.`;
    notice.classList.remove("hidden");
  }
}

function renderAccount() {
  const signedIn = Boolean(state.user);
  $("#account-view").classList.toggle("hidden", signedIn);
  $("#account-signed").classList.toggle("hidden", !signedIn);
  $("#account-label").textContent = signedIn ? state.user.name.split(" ")[0] : "Mi cuenta";
  if (signedIn) {
    $("#signed-name").textContent = state.user.name;
    $("#signed-email").textContent = state.user.email;
    $("#signed-avatar").textContent = state.user.name.trim().charAt(0).toUpperCase();
  }
}

function setAuthMode(mode) {
  state.authMode = mode;
  const form = $("#auth-form");
  $$(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.mode === mode));
  $("#name-field").classList.toggle("hidden", mode !== "register");
  form.elements.name.required = mode === "register";
  form.elements.password.autocomplete = mode === "register" ? "new-password" : "current-password";
  $("#auth-submit").textContent = mode === "register" ? "Crear cuenta" : "Iniciar sesión";
  setStatus("#auth-status", "");
}

async function loadCart() {
  if (!state.user) {
    state.cart = [];
  } else {
    try {
      const result = await request("/api/cart");
      state.cart = result.data;
    } catch {
      state.cart = [];
    }
  }
  updateCartBadge();
}

async function loadFavorites() {
  if (!state.user) {
    state.favorites = [];
  } else {
    try {
      const result = await request("/api/favorites");
      state.favorites = result.data;
    } catch {
      state.favorites = [];
    }
  }
  renderProducts();
}

async function loadSession() {
  try {
    const result = await request("/api/auth/me");
    state.user = result.user;
  } catch {
    state.user = null;
  }
  renderAccount();
  await Promise.all([loadCart(), loadFavorites()]);
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const payload = { email: data.get("email"), password: data.get("password") };
  if (state.authMode === "register") {
    payload.name = data.get("name");
  }
  try {
    const result = await request(`/api/auth/${state.authMode}`, { method: "POST", body: JSON.stringify(payload) });
    state.user = result.user;
    form.reset();
    closeDialog("account-dialog");
    renderAccount();
    showToast(result.message);
    await Promise.all([loadCart(), loadFavorites()]);
  } catch (error) {
    setStatus("#auth-status", error.message, true);
  }
}

async function handleLogout() {
  try {
    const result = await request("/api/auth/logout", { method: "POST", body: "{}" });
    state.user = null;
    state.cart = [];
    state.favorites = [];
    if (state.category === "Favoritos") {
      state.category = "Todos";
    }
    renderAccount();
    updateCartBadge();
    renderProducts();
    setStatus("#logout-status", result.message);
  } catch (error) {
    setStatus("#logout-status", error.message, true);
  }
}

function requireLogin(message) {
  if (state.user) return true;
  openDialog("account-dialog");
  showToast(message);
  return false;
}

async function addToCart(productId, quantity = 1) {
  if (!requireLogin("Inicia sesión o crea una cuenta para usar el carrito.")) return;
  try {
    const result = await request("/api/cart", { method: "POST", body: JSON.stringify({ productId, quantity }) });
    showToast(result.message);
    await loadCart();
  } catch (error) {
    showToast(error.message);
  }
}

async function toggleFavorite(productId) {
  if (!requireLogin("Inicia sesión para guardar favoritos.")) return;
  const id = Number(productId);
  const adding = !isFavorite(id);
  try {
    await request(`/api/favorites/${id}`, { method: adding ? "POST" : "DELETE" });
    state.favorites = adding ? [id, ...state.favorites] : state.favorites.filter(item => item !== id);
    renderProducts();
    if ($("#product-dialog").open) {
      renderProductDetail(id);
    }
    showToast(adding ? "Agregado a favoritos." : "Quitado de favoritos.");
  } catch (error) {
    showToast(error.message);
  }
}

function renderProductDetail(productId) {
  const product = getProduct(productId);
  if (!product) return;
  const favorite = isFavorite(product.id);
  const soldOut = Number(product.stock) <= 0;
  const related = state.products
    .filter(item => item.category === product.category && item.id !== product.id)
    .slice(0, 3);

  $("#product-detail").innerHTML = `
    <div class="detail-art product-art" data-type="${escapeHtml(product.image)}">
      <div class="shape static">${iconMarkup(product.image)}</div>
    </div>
    <div class="detail-body">
      <span class="category-label">${escapeHtml(product.category)}</span>
      <h2 id="product-title">${escapeHtml(product.name)}</h2>
      <p class="detail-description">${escapeHtml(product.description)}</p>
      <div class="detail-meta">
        <span class="price">${formatMoney(product.price)}</span>
        ${stockBadge(product.stock)}
      </div>
      <div class="detail-actions">
        <button class="btn btn-primary" type="button" data-action="add" data-id="${product.id}" ${soldOut ? "disabled" : ""}>
          ${soldOut ? "Agotado" : "Agregar al carrito"}
        </button>
        <button class="btn btn-ghost" type="button" data-action="favorite" data-id="${product.id}" aria-pressed="${favorite}">
          ${favorite ? "Quitar de favoritos" : "Guardar en favoritos"}
        </button>
      </div>
      ${related.length ? `
        <div class="related">
          <h3>Más en ${escapeHtml(product.category)}</h3>
          ${related.map(item => `
            <button class="related-item" type="button" data-action="details" data-id="${item.id}">
              <span class="related-thumb" data-type="${escapeHtml(item.image)}">${iconMarkup(item.image)}</span>
              <span>${escapeHtml(item.name)}</span>
              <strong>${formatMoney(item.price)}</strong>
            </button>`).join("")}
        </div>` : ""}
    </div>`;
}

function openProductDetail(productId) {
  renderProductDetail(productId);
  openDialog("product-dialog");
}

function cartItemMarkup(item) {
  const product = getProduct(item.product_id);
  const limit = Math.min(maxPerProduct, Number(item.stock));
  const atLimit = Number(item.quantity) >= limit;
  return `
    <div class="cart-row">
      <div class="cart-thumb">${iconMarkup(product ? product.image : item.image)}</div>
      <div class="cart-name">
        ${escapeHtml(item.name)}
        <small>${formatMoney(item.price)} c/u</small>
        <div class="qty" role="group" aria-label="Cantidad de ${escapeHtml(item.name)}">
          <button type="button" data-action="decrease" data-id="${item.product_id}" aria-label="Disminuir cantidad">−</button>
          <span>${item.quantity}</span>
          <button type="button" data-action="increase" data-id="${item.product_id}" aria-label="Aumentar cantidad" ${atLimit ? "disabled" : ""}>+</button>
        </div>
      </div>
      <strong class="line-total">${formatMoney(item.subtotal)}</strong>
      <button class="remove-item" type="button" data-action="remove" data-id="${item.product_id}" aria-label="Quitar ${escapeHtml(item.name)}">Quitar</button>
    </div>`;
}

function emptyStateMarkup(title, text, buttonMarkup = "") {
  return `<div class="cart-empty"><strong>${title}</strong>${text}${buttonMarkup}</div>`;
}

function renderCart() {
  const target = $("#cart-content");

  if (!state.user) {
    target.innerHTML = emptyStateMarkup(
      "Inicia sesión",
      "Entra a tu cuenta para consultar tu carrito.",
      '<button class="btn btn-primary" type="button" data-open="account-dialog">Iniciar sesión</button>'
    );
    return;
  }

  if (!state.cart.length) {
    target.innerHTML = emptyStateMarkup(
      "Tu carrito está vacío",
      "Explora el catálogo para agregar productos.",
      '<a class="btn btn-primary" href="#catalogo" data-action="close-cart">Explorar productos</a>'
    );
    return;
  }

  const subtotal = getCartSubtotal();
  const shipping = subtotal >= freeShippingFrom ? 0 : shippingCost;
  target.innerHTML = `
    ${state.cart.map(cartItemMarkup).join("")}
    <dl class="summary">
      <div><dt>Subtotal</dt><dd>${formatMoney(subtotal)}</dd></div>
      <div><dt>Envío</dt><dd>${shipping ? formatMoney(shipping) : "Gratis"}</dd></div>
      <div class="summary-total"><dt>Total estimado</dt><dd>${formatMoney(subtotal + shipping)}</dd></div>
    </dl>
    ${shipping ? `<p class="cart-note">Envío gratis en compras de ${formatMoney(freeShippingFrom)} o más.</p>` : ""}
    <div class="cart-actions">
      <button class="btn btn-primary full" type="button" data-action="checkout">Confirmar pedido</button>
      <button class="btn btn-ghost full" type="button" data-action="clear-cart">Vaciar carrito</button>
    </div>
    <p class="cart-note">Proyecto académico: no se procesan pagos reales.</p>`;
}

async function openCart() {
  openDialog("cart-dialog");
  setStatus("#cart-status", "");
  await loadCart();
  renderCart();
}

async function refreshCart() {
  await loadCart();
  renderCart();
  setStatus("#cart-status", "");
}

async function changeQuantity(productId, delta) {
  const item = state.cart.find(entry => Number(entry.product_id) === Number(productId));
  if (!item) return;
  const quantity = Number(item.quantity) + delta;
  try {
    if (quantity < 1) {
      await request(`/api/cart/${productId}`, { method: "DELETE" });
    } else {
      await request(`/api/cart/${productId}`, { method: "PUT", body: JSON.stringify({ quantity }) });
    }
    await refreshCart();
  } catch (error) {
    setStatus("#cart-status", error.message, true);
  }
}

async function removeFromCart(productId) {
  try {
    await request(`/api/cart/${productId}`, { method: "DELETE" });
    await refreshCart();
  } catch (error) {
    setStatus("#cart-status", error.message, true);
  }
}

async function clearCart() {
  try {
    await request("/api/cart", { method: "DELETE" });
    await refreshCart();
  } catch (error) {
    setStatus("#cart-status", error.message, true);
  }
}

async function checkout() {
  try {
    const result = await request("/api/orders", { method: "POST", body: "{}" });
    await Promise.all([loadCart(), loadProducts()]);
    $("#cart-content").innerHTML = emptyStateMarkup(
      "¡Pedido confirmado!",
      `Tu pedido #${result.order.id} por ${formatMoney(result.order.total)} quedó registrado.`,
      '<button class="btn btn-primary" type="button" data-open="orders-dialog">Ver mis pedidos</button>'
    );
    setStatus("#cart-status", "");
    showToast(result.message);
  } catch (error) {
    setStatus("#cart-status", error.message, true);
  }
}

function orderMarkup(order) {
  const items = order.items.map(item => `
    <li><span>${item.quantity} × ${escapeHtml(item.name)}</span><span>${formatMoney(item.price * item.quantity)}</span></li>
  `).join("");
  return `
    <article class="order">
      <header>
        <div><strong>Pedido #${order.id}</strong><small>${formatDate(order.created_at)}</small></div>
        <span class="order-status">${escapeHtml(order.status)}</span>
      </header>
      <ul>${items}</ul>
      <footer><span>Total</span><strong>${formatMoney(order.total)}</strong></footer>
    </article>`;
}

async function openOrders() {
  openDialog("orders-dialog");
  const target = $("#orders-content");

  if (!state.user) {
    target.innerHTML = emptyStateMarkup(
      "Inicia sesión",
      "Entra a tu cuenta para ver tus pedidos.",
      '<button class="btn btn-primary" type="button" data-open="account-dialog">Iniciar sesión</button>'
    );
    return;
  }

  target.innerHTML = '<p class="muted">Cargando pedidos…</p>';
  try {
    const result = await request("/api/orders");
    target.innerHTML = result.data.length
      ? result.data.map(orderMarkup).join("")
      : emptyStateMarkup("Aún no tienes pedidos", "Cuando confirmes una compra aparecerá aquí.");
  } catch (error) {
    target.innerHTML = `<p class="form-status error">${escapeHtml(error.message)}</p>`;
  }
}

function openFromButton(id) {
  if (id === "cart-dialog") return openCart();
  if (id === "orders-dialog") return openOrders();
  return openDialog(id);
}

function applySearch(event) {
  event.preventDefault();
  state.query = $("#search-input").value.trim().toLocaleLowerCase("es-MX");
  renderProducts();
  $("#catalogo").scrollIntoView({ behavior: "smooth" });
}

async function handleContactSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  try {
    const result = await request("/api/contact", { method: "POST", body: JSON.stringify(data) });
    setStatus("#contact-status", result.message);
    form.reset();
  } catch (error) {
    setStatus("#contact-status", error.message, true);
  }
}

function togglePassword() {
  const input = $("#password-input");
  const button = $("#toggle-pass");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  button.textContent = show ? "Ocultar" : "Mostrar";
  button.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
}

const actions = {
  add: id => addToCart(Number(id)),
  favorite: id => toggleFavorite(id),
  details: id => openProductDetail(id),
  increase: id => changeQuantity(id, 1),
  decrease: id => changeQuantity(id, -1),
  remove: id => removeFromCart(id),
  "clear-cart": () => clearCart(),
  checkout: () => checkout(),
  "close-cart": () => closeDialog("cart-dialog")
};

function handleDocumentClick(event) {
  const actionButton = event.target.closest("[data-action]");
  if (actionButton && actions[actionButton.dataset.action]) {
    actions[actionButton.dataset.action](actionButton.dataset.id);
    return;
  }

  const openButton = event.target.closest("[data-open]");
  if (openButton) {
    openFromButton(openButton.dataset.open);
    return;
  }

  const closeButton = event.target.closest("[data-close]");
  if (closeButton) {
    closeDialog(closeButton.dataset.close);
    return;
  }

  const chip = event.target.closest("[data-category]");
  if (chip) {
    if (chip.dataset.category === "Favoritos" && !requireLogin("Inicia sesión para ver tus favoritos.")) return;
    state.category = chip.dataset.category;
    renderProducts();
    return;
  }

  if (event.target.matches("dialog.modal")) {
    event.target.close();
  }
}

function bindEvents() {
  document.addEventListener("click", handleDocumentClick);
  $("#account-open").addEventListener("click", () => openDialog("account-dialog"));
  $("#cart-open").addEventListener("click", openCart);
  $("#auth-form").addEventListener("submit", handleAuthSubmit);
  $("#logout-button").addEventListener("click", handleLogout);
  $("#search-form").addEventListener("submit", applySearch);
  $("#contact-form").addEventListener("submit", handleContactSubmit);
  $("#toggle-pass").addEventListener("click", togglePassword);
  $("#sort-select").addEventListener("change", event => {
    state.sort = event.target.value;
    renderProducts();
  });
  $("#search-input").addEventListener("input", event => {
    if (!event.target.value.trim() && state.query) {
      state.query = "";
      renderProducts();
    }
  });
  $$(".tab").forEach(tab => tab.addEventListener("click", () => setAuthMode(tab.dataset.mode)));
}

bindEvents();
setAuthMode("login");
loadProducts();
loadSession();
