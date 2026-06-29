const ENVIO = 10.0;

window.addEventListener("DOMContentLoaded", () => {
  renderizarCarrito();
  cargarDireccion();
});

function obtenerCarrito() {
  return JSON.parse(sessionStorage.getItem("carrito") || "[]");
}

function guardarCarrito(carrito) {
  sessionStorage.setItem("carrito", JSON.stringify(carrito));
}

function renderizarCarrito() {
  const carrito = obtenerCarrito();
  const lista = document.getElementById("listaProductos");
  const empty = document.getElementById("emptyCart");

  document.getElementById("totalItems").textContent = carrito.length;

  if (!carrito.length) {
    lista.innerHTML = "";
    empty.style.display = "block";
    actualizarResumen(0);
    return;
  }

  empty.style.display = "none";
  lista.innerHTML = carrito.map(itemHTML).join("");
  actualizarResumen(calcularSubtotal(carrito));
}

function itemHTML(p) {
  const precio = parseFloat(p.precio_soles) || 0;
  const total = precio * (p.cantidad || 1);
  return `
    <div class="prod-item">
      <div class="prod-thumb"></div>
      <div class="prod-info">
        <p class="prod-nombre">${esc(p.nombre_producto || "Producto")}</p>
        <p class="prod-precio-unit">S/ ${precio.toFixed(2)}</p>
      </div>
      <div class="prod-controls">
        <button class="qty-btn" onclick="cambiarCantidad('${p.id_producto}', -1)">−</button>
        <span class="qty-num">${p.cantidad}</span>
        <button class="qty-btn" onclick="cambiarCantidad('${p.id_producto}', 1)">+</button>
      </div>
      <p class="prod-total">S/ ${total.toFixed(2)}</p>
      <button class="remove-btn" onclick="eliminarItem('${p.id_producto}')">✕</button>
    </div>`;
}

function cambiarCantidad(idProducto, delta) {
  const carrito = obtenerCarrito();
  const idx = carrito.findIndex(
    (p) => String(p.id_producto) === String(idProducto),
  );
  if (idx === -1) return;

  carrito[idx].cantidad += delta;
  if (carrito[idx].cantidad <= 0) carrito.splice(idx, 1);

  guardarCarrito(carrito);
  renderizarCarrito();
}

function eliminarItem(idProducto) {
  const carrito = obtenerCarrito().filter(
    (p) => String(p.id_producto) !== String(idProducto),
  );
  guardarCarrito(carrito);
  renderizarCarrito();
}

function calcularSubtotal(carrito) {
  return carrito.reduce(
    (sum, p) => sum + (parseFloat(p.precio_soles) || 0) * (p.cantidad || 1),
    0,
  );
}

function actualizarResumen(subtotal) {
  document.getElementById("subtotal").textContent = "S/ " + subtotal.toFixed(2);
  document.getElementById("total").textContent =
    "S/ " + (subtotal + ENVIO).toFixed(2);
}

function cargarDireccion() {
  const usuario = JSON.parse(
    sessionStorage.getItem("usuarioRegistrado") || "null",
  );
  const el = document.getElementById("direccionText");

  if (!usuario || !usuario.distrito) {
    el.textContent = "Sin dirección registrada";
    return;
  }

  const lat = parseFloat(usuario.latitud) || 0;
  const lon = parseFloat(usuario.longitud) || 0;

  el.innerHTML = `${esc(usuario.distrito)} — ${esc(usuario.calle || "—")}
    <br><span style="font-weight:400;color:#777">(${lat.toFixed(2)}, ${lon.toFixed(2)})</span>`;
}

// ── Formateo inputs ───────────────────────

function formatearTarjeta(input) {
  const val = input.value.replace(/\D/g, "").slice(0, 16);
  input.value = val.replace(/(.{4})/g, "$1 ").trim();
}

function formatearVencimiento(input) {
  let val = input.value.replace(/\D/g, "").slice(0, 4);
  if (val.length >= 3) val = val.slice(0, 2) + " / " + val.slice(2);
  input.value = val;
}

// ── Validación + creación del pedido ──────

async function completarCompra() {
  const carrito = obtenerCarrito();
  if (!carrito.length) {
    alert("El carrito está vacío.");
    return;
  }

  const numTarjeta = document.getElementById("numTarjeta");
  const vencimiento = document.getElementById("vencimiento");
  const cvv = document.getElementById("cvv");

  [numTarjeta, vencimiento, cvv].forEach((el) => el.classList.remove("error"));

  let valido = true;

  if (numTarjeta.value.replace(/\s/g, "").length !== 16) {
    numTarjeta.classList.add("error");
    valido = false;
  }

  const partes = vencimiento.value.replace(/\s/g, "").split("/");
  const mes = parseInt(partes[0], 10);
  const anio = parseInt(partes[1], 10);
  if (partes.length !== 2 || mes < 1 || mes > 12 || isNaN(anio)) {
    vencimiento.classList.add("error");
    valido = false;
  }

  if (cvv.value.length !== 3) {
    cvv.classList.add("error");
    valido = false;
  }

  if (!valido) {
    alert("Por favor completa correctamente los datos de pago.");
    return;
  }

  const btn = document.querySelector(".btn-completar");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Procesando…";
  }

  try {
    await guardarOrdenEnProceso(carrito, calcularSubtotal(carrito));
    sessionStorage.removeItem("carrito");
    alert("¡Compra completada con éxito! Sigue tu pedido en Mis Compras.");
    window.location.href = "orders.html";
  } catch (err) {
    alert("Ocurrió un error al procesar tu compra: " + err.message);
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Completar Compra";
    }
  }
}

// ── Órdenes en proceso / completadas ──────

function obtenerOrdenesEnProceso() {
  return JSON.parse(sessionStorage.getItem("ordenesEnProceso") || "[]");
}

function obtenerOrdenesCompletadas() {
  return JSON.parse(sessionStorage.getItem("ordenesCompletadas") || "[]");
}

// El pedido se crea en estado "Preparando" dentro de ordenesEnProceso.
// Su recorrido real (UCS + viaje en tiempo real) se calcula en
// maproute.html; recién al llegar se mueve a ordenesCompletadas.
async function guardarOrdenEnProceso(carrito, subtotal) {
  const usuario = JSON.parse(
    sessionStorage.getItem("usuarioRegistrado") || "null",
  );
  const idRestaurante = carrito[0].id_restaurante;
  const restaurante = await obtenerRestaurantePorId(idRestaurante);

  const ordenesProceso = obtenerOrdenesEnProceso();
  const idsExistentes = [...ordenesProceso, ...obtenerOrdenesCompletadas()];

  const nuevaOrden = {
    id: generarIdOrden(idsExistentes),
    fecha: new Date().toISOString(),
    estado: "Preparando",
    distrito: (usuario && usuario.distrito) || "—",
    direccion: (usuario && usuario.calle) || "—",
    origen: {
      lat: usuario ? parseFloat(usuario.latitud) : null,
      lon: usuario ? parseFloat(usuario.longitud) : null,
    },
    destino: {
      lat: restaurante ? parseFloat(restaurante.latitud) : null,
      lon: restaurante ? parseFloat(restaurante.longitud) : null,
      nombre: restaurante ? restaurante.nombre : "Restaurante",
    },
    id_restaurante: idRestaurante,
    productos: carrito,
    totalProductos: carrito.reduce((sum, p) => sum + (p.cantidad || 1), 0),
    subtotal: subtotal,
    envio: ENVIO,
    total: subtotal + ENVIO,
  };

  ordenesProceso.push(nuevaOrden);
  sessionStorage.setItem("ordenesEnProceso", JSON.stringify(ordenesProceso));
}

async function obtenerRestaurantePorId(id) {
  try {
    const res = await fetch("../csvs/restaurants.csv");
    if (!res.ok) return null;
    const texto = await res.text();
    const filas = parsearCSV(texto);
    return filas.find((r) => String(r.id_restaurante) === String(id)) || null;
  } catch (err) {
    console.error("No se pudo cargar restaurants.csv:", err);
    return null;
  }
}

function parsearCSV(text) {
  const lineas = text.trim().split("\n");
  if (lineas.length < 2) return [];
  const headers = parsearFila(lineas[0]);
  const filas = [];
  for (let i = 1; i < lineas.length; i++) {
    const vals = parsearFila(lineas[i]);
    if (vals.length < 2) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = (vals[idx] || "").trim();
    });
    filas.push(obj);
  }
  return filas;
}

function parsearFila(linea) {
  const res = [];
  let actual = "",
    enComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (ch === '"') {
      enComillas = !enComillas;
    } else if (ch === "," && !enComillas) {
      res.push(actual);
      actual = "";
    } else {
      actual += ch;
    }
  }
  res.push(actual);
  return res;
}

function generarIdOrden(ordenes) {
  const year = new Date().getFullYear();
  let maxNum = 0;
  ordenes.forEach((o) => {
    const match = /^ORD-(\d{4})(\d{4,})$/.exec(o.id || "");
    if (match && parseInt(match[1], 10) === year) {
      maxNum = Math.max(maxNum, parseInt(match[2], 10));
    }
  });
  return `ORD-${year}${String(maxNum + 1).padStart(4, "0")}`;
}

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
