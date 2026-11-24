const state = {
  currentView: "operadores",
  adminKey: "admin1",
  operators: [
    {
      id: 1,
      name: "Carlos Mendoza",
      role: "Operador",
      pin: "1234",
      permissions: ["Ventas"],
    },
  ],
  products: [
    { id: "p1", name: "Desengrasante Industrial 20L", price: 35.0, stock: 25 },
    { id: "p2", name: "Limpiador Multiuso Concentrado", price: 12.0, stock: 40 },
    { id: "p3", name: "Cera Automotriz Premium", price: 18.0, stock: 15 },
  ],
  customers: [
    { id: "c1", name: "Cliente Mostrador" },
    { id: "c2", name: "Taller La Morita C.A." },
    { id: "c3", name: "Comercial del Centro" },
  ],
  sales: [],
  receivables: [],
};

// Elementos de Cuentas de Operadores
const operatorForm = document.getElementById("operatorForm");
const editingOperatorIdInput = document.getElementById("editingOperatorId");
const operatorFormHeading = document.getElementById("operatorFormHeading");
const submitOperatorBtn = document.getElementById("submitOperatorBtn");
const cancelEditOperatorBtn = document.getElementById("cancelEditOperatorBtn");
const operatorNameInput = document.getElementById("operatorName");
const operatorRoleSelect = document.getElementById("operatorRole");
const operatorPinInput = document.getElementById("operatorPin");
const permissionsGrid = document.getElementById("permissionsGrid");
const operatorsList = document.getElementById("operatorsList");

// Clave Admin
const newAdminKeyInput = document.getElementById("newAdminKeyInput");
const saveAdminKeyBtn = document.getElementById("saveAdminKeyBtn");
const currentAdminKeyLabel = document.getElementById("currentAdminKeyLabel");

// Búsqueda y Navegación
const searchInput = document.getElementById("searchInput");
const viewTitle = document.getElementById("viewTitle");

// Ventas y Crédito / Fiado
const saleForm = document.getElementById("saleForm");
const saleProductSelect = document.getElementById("saleProduct");
const saleQtyInput = document.getElementById("saleQty");
const saleCustomerSelect = document.getElementById("saleCustomer");
const saleConditionSelect = document.getElementById("saleCondition");
const saleDiscountInput = document.getElementById("saleDiscount");
const saleAdminKeyInput = document.getElementById("saleAdminKey");
const saleFeedback = document.getElementById("saleFeedback");
const receivablesList = document.getElementById("receivablesList");
const salesHistoryList = document.getElementById("salesHistoryList");

function syncPermissionTiles() {
  permissionsGrid.querySelectorAll(".permission-tile").forEach((tile) => {
    const cb = tile.querySelector('input[type="checkbox"]');
    tile.classList.toggle("checked", Boolean(cb && cb.checked));
  });
}

function getSelectedPermissions() {
  return Array.from(permissionsGrid.querySelectorAll('input[type="checkbox"]:checked')).map(
    (cb) => cb.value
  );
}

function setSelectedPermissions(perms) {
  permissionsGrid.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.checked = perms.includes(cb.value);
  });
  syncPermissionTiles();
}

function applyPermissionPreset(mode) {
  permissionsGrid.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    if (mode === "sales") {
      cb.checked = cb.value === "Ventas";
    } else if (mode === "all") {
      cb.checked = true;
    } else {
      cb.checked = false;
    }
  });
  syncPermissionTiles();
}

function resetOperatorForm() {
  editingOperatorIdInput.value = "";
  operatorFormHeading.textContent = "Crear nuevo operador";
  submitOperatorBtn.textContent = "Guardar operador";
  cancelEditOperatorBtn.classList.add("hidden");
  operatorForm.reset();
  operatorRoleSelect.value = "Operador";
  applyPermissionPreset("sales");
}

window.editOperator = function (id) {
  const op = state.operators.find((item) => item.id === id);
  if (!op) return;
  editingOperatorIdInput.value = String(op.id);
  operatorFormHeading.textContent = `Editando operador: ${op.name}`;
  submitOperatorBtn.textContent = "Actualizar operador";
  cancelEditOperatorBtn.classList.remove("hidden");
  operatorNameInput.value = op.name;
  operatorRoleSelect.value = op.role;
  operatorPinInput.value = op.pin || "";
  setSelectedPermissions(op.permissions || []);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.deleteOperator = function (id) {
  state.operators = state.operators.filter((item) => item.id !== id);
  if (editingOperatorIdInput.value === String(id)) {
    resetOperatorForm();
  }
  renderOperators(searchInput.value);
};

function renderOperators(filterText = "") {
  const query = filterText.trim().toLowerCase();
  const filtered = state.operators.filter(
    (op) =>
      op.name.toLowerCase().includes(query) ||
      op.role.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    operatorsList.innerHTML =
      '<div class="empty-state">No hay operadores registrados o que coincidan con la búsqueda.</div>';
    return;
  }

  operatorsList.innerHTML = filtered
    .map(
      (op) => `
      <div class="operator-item">
        <div>
          <strong>${op.name}</strong> · <span>${op.role}</span>
          <div class="operator-meta">
            PIN: ${op.pin ? op.pin : "Sin PIN"} · Permisos: ${
        op.permissions.length ? op.permissions.join(", ") : "Ninguno"
      }
          </div>
        </div>
        <div class="item-actions">
          <button type="button" class="btn btn-ghost" onclick="editOperator(${op.id})">Editar</button>
          <button type="button" class="btn btn-ghost" onclick="deleteOperator(${op.id})">Eliminar</button>
        </div>
      </div>
    `
    )
    .join("");
}

function populateSaleSelectors() {
  saleProductSelect.innerHTML = state.products
    .map(
      (p) =>
        `<option value="${p.id}">${p.name} ($${p.price.toFixed(2)} · Stock: ${p.stock})</option>`
    )
    .join("");

  saleCustomerSelect.innerHTML = state.customers
    .map((c) => `<option value="${c.name}">${c.name}</option>`)
    .join("");
}

function renderSalesAndReceivables() {
  if (state.receivables.length === 0) {
    receivablesList.innerHTML =
      '<div class="empty-state">No hay saldos pendientes en cuentas por cobrar.</div>';
  } else {
    receivablesList.innerHTML = state.receivables
      .map(
        (r) => `
        <div class="operator-item">
          <div>
            <strong>${r.customer}</strong> · <span>Saldo: $${r.balance.toFixed(2)}</span>
            <div class="operator-meta">${r.productName} (x${r.qty}) · Autorizado con clave admin</div>
          </div>
        </div>
      `
      )
      .join("");
  }

  if (state.sales.length === 0) {
    salesHistoryList.innerHTML =
      '<div class="empty-state">Aún no se han registrado ventas en esta sesión.</div>';
  } else {
    salesHistoryList.innerHTML = state.sales
      .map(
        (s) => `
        <div class="operator-item">
          <div>
            <strong>${s.productName}</strong> (x${s.qty}) · <span>$${s.total.toFixed(2)}</span>
            <div class="operator-meta">
              Cliente: ${s.customer} · Condición: ${
          s.condition === "credito" ? "Crédito / Fiado" : "Contado"
        } · Descuento: ${s.discount}%
            </div>
          </div>
        </div>
      `
      )
      .join("");
  }
}

function switchView(viewName) {
  state.currentView = viewName;
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });

  document.querySelectorAll(".view-section").forEach((sec) => {
    sec.classList.remove("active");
  });

  if (viewName === "operadores") {
    viewTitle.textContent = "Cuentas de operadores";
    searchInput.placeholder = "Buscar en cuentas de operadores...";
    document.getElementById("view-operadores").classList.add("active");
    renderOperators(searchInput.value);
  } else if (viewName === "ventas") {
    viewTitle.textContent = "Ventas y Crédito / Fiado";
    searchInput.placeholder = "Buscar...";
    document.getElementById("view-ventas").classList.add("active");
    populateSaleSelectors();
    renderSalesAndReceivables();
  } else {
    const labelMap = {
      resumen: "Resumen General",
      operativo: "Control Operativo",
      productos: "Productos e Inventario",
      proveedores: "Proveedores",
      clientes: "Clientes afiliados",
      cierre: "Cierre de caja",
      monedas: "Monedas",
      tasa: "Tasa de cambio",
      pago: "Tipo de pago",
      factura: "Factura",
    };
    const title = labelMap[viewName] || "Módulo";
    viewTitle.textContent = title;
    document.getElementById("genericTitle").textContent = title;
    document.getElementById("genericDescription").textContent =
      "Estructura activa en Génesis v12 con tema oscuro suave y permisos configurables.";
    document.getElementById("genericContent").innerHTML = state.products
      .map(
        (p) => `
        <div class="operator-item">
          <div>
            <strong>${p.name}</strong>
            <div class="operator-meta">Precio unitario: $${p.price.toFixed(2)} · Stock disponible: ${p.stock}</div>
          </div>
        </div>
      `
      )
      .join("");
    document.getElementById("view-generic").classList.add("active");
  }
}

// Eventos de navegación
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

// Eventos de permisos y operadores (sin cuentaAsignada)
permissionsGrid.addEventListener("change", syncPermissionTiles);
document.getElementById("presetOnlySales").addEventListener("click", () => applyPermissionPreset("sales"));
document.getElementById("presetAll").addEventListener("click", () => applyPermissionPreset("all"));
document.getElementById("presetNone").addEventListener("click", () => applyPermissionPreset("none"));
cancelEditOperatorBtn.addEventListener("click", resetOperatorForm);

saveAdminKeyBtn.addEventListener("click", () => {
  const nextKey = newAdminKeyInput.value.trim();
  if (!nextKey) return;
  state.adminKey = nextKey;
  currentAdminKeyLabel.textContent = nextKey;
  newAdminKeyInput.value = "";
});

searchInput.addEventListener("input", (e) => {
  if (state.currentView === "operadores") {
    renderOperators(e.target.value);
  }
});

operatorForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = operatorNameInput.value.trim();
  if (!name) return;

  const payload = {
    name,
    role: operatorRoleSelect.value,
    pin: operatorPinInput.value.trim() || null,
    permissions: getSelectedPermissions(),
  };

  const editingId = editingOperatorIdInput.value;
  if (editingId) {
    state.operators = state.operators.map((op) =>
      String(op.id) === editingId ? { ...op, ...payload } : op
    );
  } else {
    state.operators.push({
      id: Date.now(),
      ...payload,
    });
  }

  resetOperatorForm();
  renderOperators(searchInput.value);
});

// Venta a Contado o Crédito / Fiado protegida por clave admin
saleForm.addEventListener("submit", (e) => {
  e.preventDefault();
  saleFeedback.textContent = "";
  saleFeedback.className = "feedback-msg";

  const product = state.products.find((p) => p.id === saleProductSelect.value);
  const qty = Number(saleQtyInput.value);
  const customer = saleCustomerSelect.value;
  const condition = saleConditionSelect.value;
  const discount = Math.min(100, Math.max(0, Number(saleDiscountInput.value) || 0));
  const providedAdminKey = saleAdminKeyInput.value.trim();

  if (!product || qty < 1) {
    saleFeedback.textContent = "Selecciona un producto y una cantidad válida.";
    saleFeedback.classList.add("error");
    return;
  }

  if (qty > product.stock) {
    saleFeedback.textContent = `Stock insuficiente. Disponible: ${product.stock} unidades.`;
    saleFeedback.classList.add("error");
    return;
  }

  const requiresAdmin = condition === "credito" || discount > 0;
  if (requiresAdmin && providedAdminKey !== state.adminKey) {
    saleFeedback.textContent =
      "Autorización denegada: se requiere la clave de administrador válida para ventas a crédito/fiado o descuentos.";
    saleFeedback.classList.add("error");
    return;
  }

  const subtotal = product.price * qty;
  const total = subtotal - subtotal * (discount / 100);

  // Descontar inventario
  product.stock -= qty;

  // Registrar venta
  state.sales.unshift({
    id: Date.now(),
    productName: product.name,
    qty,
    customer,
    condition,
    discount,
    total,
  });

  // Registrar saldo en cuentas por cobrar si es crédito / fiado
  if (condition === "credito") {
    state.receivables.unshift({
      id: Date.now() + 1,
      customer,
      productName: product.name,
      qty,
      balance: total,
    });
  }

  populateSaleSelectors();
  renderSalesAndReceivables();
  saleAdminKeyInput.value = "";
  saleDiscountInput.value = "0";
  saleQtyInput.value = "1";

  saleFeedback.textContent =
    condition === "credito"
      ? `Venta a crédito registrada por $${total.toFixed(2)}. Inventario descontado y saldo enviado a Cuentas por Cobrar.`
      : `Venta de contado registrada por $${total.toFixed(2)}. Inventario actualizado.`;
  saleFeedback.classList.add("success");
});

syncPermissionTiles();
renderOperators();
populateSaleSelectors();
renderSalesAndReceivables();
