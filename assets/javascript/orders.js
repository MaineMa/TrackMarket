let tabActual = "proceso";
let ordenesProcesoActuales = [];
let ordenesCompletadasActuales = [];

window.addEventListener("DOMContentLoaded", () => {
  renderizarOrdenes();
});

function obtenerOrdenesCompletadas() {
  return JSON.parse(sessionStorage.getItem("ordenesCompletadas") || "[]");
}

function obtenerOrdenesEnProceso() {
  return JSON.parse(sessionStorage.getItem("ordenesEnProceso") || "[]");
}

function renderizarOrdenes() {
  ordenesProcesoActuales = obtenerOrdenesEnProceso().slice().reverse(); // más recientes primero
  ordenesCompletadasActuales = obtenerOrdenesCompletadas().slice().reverse(); // más recientes primero

  document.getElementById("countProceso").textContent =
    ordenesProcesoActuales.length;
  document.getElementById("countCompletadas").textContent =
    ordenesCompletadasActuales.length;

  document.getElementById("listaProceso").innerHTML = ordenesProcesoActuales
    .map(ordenProcesoHTML)
    .join("");

  document.getElementById("listaCompletadas").innerHTML =
    ordenesCompletadasActuales.map(ordenCompletadaHTML).join("");

  actualizarVistaTab();
}

function cambiarTab(tab) {
  tabActual = tab;
  document
    .getElementById("tabProceso")
    .classList.toggle("active", tab === "proceso");
  document
    .getElementById("tabCompletadas")
    .classList.toggle("active", tab === "completadas");
  actualizarVistaTab();
}

function actualizarVistaTab() {
  const enProceso = tabActual === "proceso";

  document.getElementById("listaProceso").style.display = enProceso
    ? "flex"
    : "none";
  document.getElementById("listaCompletadas").style.display = enProceso
    ? "none"
    : "flex";

  const listaActual = enProceso
    ? ordenesProcesoActuales
    : ordenesCompletadasActuales;
  const empty = document.getElementById("emptyState");

  if (!listaActual.length) {
    empty.style.display = "block";
    document.getElementById("emptyMsg").textContent = enProceso
      ? "No tienes compras en proceso."
      : "Aún no tienes compras completadas.";
  } else {
    empty.style.display = "none";
  }
}

function claseEstado(estado) {
  if (estado === "En camino") return "en-camino";
  if (estado === "Completada") return "completada";
  return "preparando";
}

function ordenProcesoHTML(o) {
  return `
    <div class="orden-card">
      <div class="orden-top">
        <span class="orden-id">#${esc(o.id)}</span>
        <span class="badge-estado ${claseEstado(o.estado)}">${esc(o.estado || "Preparando")}</span>
      </div>
      <p class="orden-resumen">${o.totalProductos} producto${o.totalProductos === 1 ? "" : "s"} · S/ ${o.total.toFixed(2)}</p>
      <p class="orden-meta">${esc(formatearFecha(o.fecha))} · ${esc(o.distrito || "—")}</p>
      <div class="orden-footer">
        <button class="btn-mapa" onclick="verRecorrido('${esc(o.id)}')">
          Ver Recorrido en Mapa
        </button>
      </div>
    </div>`;
}

function verRecorrido(id) {
  window.location.href = "maproute.html?id=" + encodeURIComponent(id);
}

function ordenCompletadaHTML(o) {
  return `
    <div class="orden-card">
      <div class="orden-top">
        <span class="orden-id">#${esc(o.id)}</span>
        <span class="badge-estado completada">Completada</span>
      </div>
      <p class="orden-resumen">${o.totalProductos} producto${o.totalProductos === 1 ? "" : "s"} · S/ ${o.total.toFixed(2)}</p>
      <p class="orden-meta">${esc(formatearFecha(o.fecha))} · ${esc(o.distrito || "—")}</p>
      <div class="orden-footer">
        <button class="btn-detalle" onclick="toggleDetalle('${esc(o.id)}')">
          Ver productos
        </button>
        <button class="btn-mapa" onclick="verRecorrido('${esc(o.id)}')">
          Ver Recorrido en Mapa
        </button>
      </div>
      <div class="orden-productos" id="detalle-${esc(o.id)}" style="display: none">
        ${(o.productos || []).map(productoRowHTML).join("")}
      </div>
    </div>`;
}

function productoRowHTML(p) {
  const precio = parseFloat(p.precio_soles) || 0;
  const cant = p.cantidad || 1;
  return `
    <div class="orden-prod-row">
      <span>${esc(p.nombre_producto || "Producto")} × ${cant}</span>
      <span>S/ ${(precio * cant).toFixed(2)}</span>
    </div>`;
}

function toggleDetalle(id) {
  const el = document.getElementById("detalle-" + id);
  if (!el) return;
  el.style.display = el.style.display === "none" ? "flex" : "none";
}

const MESES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function formatearFecha(iso) {
  const f = new Date(iso);
  if (isNaN(f.getTime())) return "—";
  return `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`;
}

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
