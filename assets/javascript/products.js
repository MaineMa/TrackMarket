const CSV_REST = "../csvs/restaurants.csv";
const CSV_PROD = "../csvs/products.csv";

let todosRest = [];
let todosProd = [];
let prodActuales = [];
let restActual = null;

window.addEventListener("DOMContentLoaded", () => {
  setLoadMsg("Cargando datos…");
  cargarAmbos();
});

async function cargarAmbos() {
  try {
    const [textRest, textProd] = await Promise.all([
      fetchTexto(CSV_REST),
      fetchTexto(CSV_PROD),
    ]);

    todosRest = parsearCSV(textRest);
    todosProd = parsearCSV(textProd);

    if (!todosRest.length) throw new Error(CSV_REST + " está vacío.");
    if (!todosProd.length) throw new Error(CSV_PROD + " está vacío.");

    document.getElementById("loadState").style.display = "none";
    inicializar();
  } catch (err) {
    setLoadMsg(
      "⚠ " + err.message + " — Ejecuta los scripts Python y recarga la página.",
    );
  }
}

async function fetchTexto(url) {
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(
      "No se encontró '" +
        url +
        "'. " +
        "Ejecuta: " +
        url.replace(".csv", "") +
        ".py",
    );
  return res.text();
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
  const params = new URLSearchParams(window.location.search);
  const idUrl = params.get("id");

  if (idUrl) {
    document.getElementById("restBanner").style.display = "flex";
    cargarRestaurante(idUrl);
  } else {
    document.getElementById("selectorBox").style.display = "block";
    poblarSelector();
  }
}

function poblarSelector() {
  const sel = document.getElementById("restSelect");
  todosRest
    .slice()
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""))
    .forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.id_restaurante;
      opt.textContent = `#${r.id_restaurante} — ${r.nombre} (${r.distrito})`;
      sel.appendChild(opt);
    });
}

function cambiarRest(id) {
  if (!id) {
    limpiarVista();
    return;
  }
  document.getElementById("restBanner").style.display = "flex";
  cargarRestaurante(id);
}

function cargarRestaurante(id) {
  const idStr = String(id).trim();
  restActual =
    todosRest.find((r) => String(r.id_restaurante).trim() === idStr) || null;

  if (!restActual) {
    setLoadMsg("No se encontró el restaurante con ID " + id + ".");
    document.getElementById("loadState").style.display = "flex";
    return;
  }

  document.getElementById("bannerNombre").textContent =
    restActual.nombre || "—";
  document.getElementById("bannerTipo").textContent = restActual.tipo || "—";
  document.getElementById("bannerDist").textContent =
    restActual.distrito || "—";
  document.getElementById("bannerRating").textContent =
    "★ " + (restActual.rating || "—");
  document.getElementById("bannerSub").innerHTML =
    esc(restActual.direccion || "") +
    (restActual.horario ? ` &nbsp;·&nbsp; ${esc(restActual.horario)}` : "") +
    (restActual.telefono ? ` &nbsp;·&nbsp; ${esc(restActual.telefono)}` : "");

  prodActuales = todosProd.filter(
    (p) => String(p.id_restaurante).trim() === idStr,
  );

  actualizarStats(prodActuales);

  document.getElementById("controlsBar").style.display = "flex";
  document.getElementById("statsRow").style.display = "grid";
  document.getElementById("gridProd").style.display = "grid";

  filtrarProd();
}

function filtrarProd() {
  const busqueda = (
    document.getElementById("searchProd").value || ""
  ).toLowerCase();
  const disp = document.getElementById("filtroDisp").value;
  const orden = document.getElementById("filtroOrden").value;

  let lista = prodActuales.filter((p) => {
    const matchB =
      !busqueda ||
      (p.nombre_producto || "").toLowerCase().includes(busqueda) ||
      (p.descripcion || "").toLowerCase().includes(busqueda);
    const matchD = !disp || (p.disponible || "").toUpperCase() === disp;
    return matchB && matchD;
  });

  if (orden === "asc") lista.sort((a, b) => +a.precio_soles - +b.precio_soles);
  if (orden === "desc") lista.sort((a, b) => +b.precio_soles - +a.precio_soles);

  document.getElementById("prodCount").textContent =
    lista.length + " de " + prodActuales.length + " productos";

  const grid = document.getElementById("gridProd");
  const empty = document.getElementById("emptyState");

  if (!lista.length) {
    grid.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  grid.innerHTML = lista.map(tarjetaProdHTML).join("");
}

function tarjetaProdHTML(p) {
  const precio = parseFloat(p.precio_soles) || 0;
  const disp = (p.disponible || "").toUpperCase() === "SI";
  return `
    <div class="prod-card ${disp ? "" : "no-disp"}">
        <p class="prod-nombre">${esc(p.nombre_producto || "Sin nombre")}</p>
        <p class="prod-desc">${esc(p.descripcion || "")}</p>
        <div class="prod-footer">
            <p class="prod-precio">S/ ${precio.toFixed(2)} <span>soles</span></p>
            <span class="badge-disp ${disp ? "si" : "no"}">${disp ? "Disponible" : "No disponible"}</span>
        </div>
    </div>`;
}

function actualizarStats(lista) {
  if (!lista.length) return;
  const precios = lista.map((p) => parseFloat(p.precio_soles) || 0);
  const sum = precios.reduce((a, b) => a + b, 0);
  document.getElementById("statTotal").textContent = lista.length;
  document.getElementById("statMin").textContent =
    "S/ " + Math.min(...precios).toFixed(2);
  document.getElementById("statMax").textContent =
    "S/ " + Math.max(...precios).toFixed(2);
  document.getElementById("statProm").textContent =
    "S/ " + (sum / precios.length).toFixed(2);
}

function limpiarVista() {
  document.getElementById("restBanner").style.display = "none";
  document.getElementById("controlsBar").style.display = "none";
  document.getElementById("statsRow").style.display = "none";
  document.getElementById("gridProd").innerHTML = "";
  document.getElementById("gridProd").style.display = "none";
  document.getElementById("emptyState").style.display = "none";
  prodActuales = [];
  restActual = null;
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
