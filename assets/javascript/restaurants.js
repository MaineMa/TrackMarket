const CSV_RESTAURANTES = "../csvs/restaurants.csv";

let todosLosRest = [];
let tiposUnicos = new Set();

window.addEventListener("DOMContentLoaded", () => {
  cargarCSV();
  actualizarBadgeCarrito();
});

function cargarCSV() {
  setLoadMsg("Cargando " + CSV_RESTAURANTES + "…");

  fetch(CSV_RESTAURANTES)
    .then((res) => {
      if (!res.ok)
        throw new Error(
          "No se encontró '" +
            CSV_RESTAURANTES +
            "'. " +
            "Ejecuta primero: restaurants.py",
        );
      return res.text();
    })
    .then((text) => {
      todosLosRest = parsearCSV(text);
      if (!todosLosRest.length) throw new Error("El CSV está vacío.");
      inicializar();
    })
    .catch((err) => {
      setLoadMsg("⚠ " + err.message);
    });
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

function inicializar() {
  todosLosRest.forEach((r) => {
    if (r.tipo) tiposUnicos.add(r.tipo);
  });

  const sel = document.getElementById("filtroTipo");
  [...tiposUnicos].sort().forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  });

  document.getElementById("loadState").style.display = "none";
  document.getElementById("grid").style.display = "grid";
  filtrar();
}

function filtrar() {
  const busqueda = document.getElementById("searchInput").value.toLowerCase();
  const dist = document.getElementById("filtroDist").value;
  const tipo = document.getElementById("filtroTipo").value;
  const minRating =
    parseFloat(document.getElementById("filtroRating").value) || 0;

  const filtrados = todosLosRest.filter((r) => {
    const matchB =
      !busqueda ||
      (r.nombre || "").toLowerCase().includes(busqueda) ||
      (r.tipo || "").toLowerCase().includes(busqueda);
    const matchD = !dist || r.distrito === dist;
    const matchT = !tipo || r.tipo === tipo;
    const matchR = (parseFloat(r.rating) || 0) >= minRating;
    return matchB && matchD && matchT && matchR;
  });

  document.getElementById("resultCount").textContent =
    filtrados.length + " de " + todosLosRest.length + " restaurantes";

  const grid = document.getElementById("grid");
  const empty = document.getElementById("emptyState");

  if (!filtrados.length) {
    grid.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  grid.innerHTML = filtrados.map(tarjetaHTML).join("");
}

function tarjetaHTML(r) {
  const rating = parseFloat(r.rating) || 0;
  const stars = rating >= 4.5 ? "⭐ " + rating : "★ " + rating.toFixed(1);
  const lat = parseFloat(r.latitud) || 0;
  const lon = parseFloat(r.longitud) || 0;

  return `
    <div class="rest-card" onclick="irAProductos(${r.id_restaurante})">
        <div class="card-head">
            <p class="card-nombre">${esc(r.nombre || "Sin nombre")}</p>
            <span class="badge-rating">${stars}</span>
        </div>
        <span class="badge-tipo">${esc(r.tipo || "—")}</span>
        <div class="card-info">
            <span><span class="info-label">Distrito</span>${esc(r.distrito || "—")}</span>
            <span><span class="info-label">Dirección</span>${esc(r.direccion || "—")}</span>
            <span><span class="info-label">Horario</span>${esc(r.horario || "—")}</span>
            <span><span class="info-label">Teléfono</span>${esc(r.telefono || "—")}</span>
            <span><span class="info-label">Coords</span>${lat.toFixed(4)}, ${lon.toFixed(4)}</span>
        </div>
        <div class="card-footer">
            <span class="card-id">#${r.id_restaurante}</span>
            <button class="ver-productos-btn"
                onclick="event.stopPropagation();irAProductos(${r.id_restaurante})">
                Ver productos →
            </button>
        </div>
    </div>`;
}

function irAProductos(id) {
  window.location.href = "products.html?id=" + id;
}

function setLoadMsg(msg) {
  const el = document.getElementById("loadMsg");
  if (el) el.textContent = msg;
  document.getElementById("loadState").style.display = "flex";
}

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function actualizarBadgeCarrito() {
  const carrito = JSON.parse(sessionStorage.getItem("carrito") || "[]");
  const badge = document.getElementById("carritoCount");
  if (!badge) return;
  if (carrito.length > 0) {
    badge.textContent = carrito.length;
    badge.style.display = "inline-flex";
  } else {
    badge.style.display = "none";
  }
}
