const CSV_DATASET = "../csvs/TB1_1ACC0184_2026-10_Dataset.csv";

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

let usuario = null;
let edicionTemp = null;

// ── Estado del mapa de edición (igual patrón que register.js) ──
let mapa = null;
let todosLosNodos = [];
let capaNodos = null;
let marcadorActivo = null;
let datasetCargado = false;

window.addEventListener("DOMContentLoaded", () => {
  cargarUsuario();
});

// ───────────────────────────────────────────────────────────
// Carga y render de la vista
// ───────────────────────────────────────────────────────────

function cargarUsuario() {
  usuario = JSON.parse(sessionStorage.getItem("usuarioRegistrado") || "null");

  if (!usuario) {
    document.getElementById("contenidoPerfil").style.display = "none";
    document.getElementById("btnEditar").style.display = "none";
    document.getElementById("sinSesion").style.display = "flex";
    return;
  }

  renderizarVista();
}

function renderizarVista() {
  const iniciales =
    (
      (usuario.nombre || "").charAt(0) + (usuario.apellidos || "").charAt(0)
    ).toUpperCase() || "?";
  document.getElementById("avatarIniciales").textContent = iniciales;

  document.getElementById("perfilNombre").textContent =
    `${usuario.nombre || ""} ${usuario.apellidos || ""}`.trim() || "—";
  document.getElementById("perfilEmail").textContent = usuario.email || "—";

  const enProceso = JSON.parse(
    sessionStorage.getItem("ordenesEnProceso") || "[]",
  );
  const completadas = JSON.parse(
    sessionStorage.getItem("ordenesCompletadas") || "[]",
  );
  const totalCompras = enProceso.length + completadas.length;
  document.getElementById("statCompras").textContent =
    `${totalCompras} compra${totalCompras === 1 ? "" : "s"} total${totalCompras === 1 ? "" : "es"}`;

  document.getElementById("statMiembro").textContent =
    "Miembro desde " + formatearMesAnio(usuario.fechaRegistro);

  document.getElementById("statUbicacion").textContent =
    `${usuario.distrito || "—"} · ${usuario.calle || "—"}`;

  document.getElementById("inputNombre").value = usuario.nombre || "";
  document.getElementById("inputApellido").value = usuario.apellidos || "";
  document.getElementById("inputEmail").value = usuario.email || "";
  document.getElementById("inputTelefono").value = usuario.telefono || "";

  actualizarResumenUbicacion();
  actualizarBloqueoUbicacion();
}

function actualizarResumenUbicacion() {
  const lat = parseFloat(usuario.latitud) || 0;
  const lon = parseFloat(usuario.longitud) || 0;
  document.getElementById("ubicacionResumenTexto").textContent =
    `${usuario.distrito || "—"} · ${usuario.calle || "—"} (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
}

function hayOrdenesEnProceso() {
  return (
    JSON.parse(sessionStorage.getItem("ordenesEnProceso") || "[]").length > 0
  );
}

function actualizarBloqueoUbicacion() {
  const aviso = document.getElementById("avisoUbicacionBloqueada");
  if (aviso) {
    aviso.style.display = hayOrdenesEnProceso() ? "block" : "none";
  }
}

function formatearMesAnio(iso) {
  if (!iso) return "—";
  const f = new Date(iso);
  if (isNaN(f.getTime())) return "—";
  return `${MESES[f.getMonth()]} ${f.getFullYear()}`;
}

// ───────────────────────────────────────────────────────────
// Modo edición
// ───────────────────────────────────────────────────────────

const CAMPOS_EDITABLES = [
  "inputNombre",
  "inputApellido",
  "inputEmail",
  "inputTelefono",
];

function entrarModoEdicion() {
  edicionTemp = { ...usuario }; // snapshot para poder cancelar

  CAMPOS_EDITABLES.forEach((id) => {
    document.getElementById(id).disabled = false;
  });

  document.getElementById("btnEditar").style.display = "none";
  document.getElementById("editActions").style.display = "flex";

  if (hayOrdenesEnProceso()) {
    // No se permite tocar la ubicación mientras haya un pedido en curso:
    document.getElementById("ubicacionVista").style.display = "block";
    document.getElementById("ubicacionEdicion").style.display = "none";
  } else {
    document.getElementById("ubicacionVista").style.display = "none";
    document.getElementById("ubicacionEdicion").style.display = "block";
    inicializarEdicionUbicacion();
  }
}

function salirModoEdicion() {
  CAMPOS_EDITABLES.forEach((id) => {
    const input = document.getElementById(id);
    input.disabled = true;
    input.classList.remove("error");
  });
  limpiarErrores();

  document.getElementById("btnEditar").style.display = "inline-block";
  document.getElementById("editActions").style.display = "none";

  document.getElementById("ubicacionVista").style.display = "block";
  document.getElementById("ubicacionEdicion").style.display = "none";
}

function cancelarEdicion() {
  usuario = edicionTemp; // descarta cualquier cambio (incluida la ubicación)
  edicionTemp = null;
  salirModoEdicion();
  renderizarVista();
}

function guardarPerfil() {
  const nombre = document.getElementById("inputNombre").value.trim();
  const apellido = document.getElementById("inputApellido").value.trim();
  const email = document.getElementById("inputEmail").value.trim();
  const telefono = document.getElementById("inputTelefono").value.trim();

  limpiarErrores();
  let valido = true;

  if (!nombre) {
    marcarError("inputNombre", "Ingresa tu nombre.");
    valido = false;
  }
  if (!apellido) {
    marcarError("inputApellido", "Ingresa tu apellido.");
    valido = false;
  }
  if (!email.includes("@")) {
    marcarError("inputEmail", "Ingresa un correo válido.");
    valido = false;
  }
  if (!/^\d{9}$/.test(telefono)) {
    marcarError("inputTelefono", "El teléfono debe tener 9 dígitos.");
    valido = false;
  }

  if (!valido) return;

  // distrito/calle/latitud/longitud ya quedaron actualizados en "usuario"
  // si el usuario hizo clic en un marcador del mapa (ver seleccionarMarcadorEdit).
  usuario.nombre = nombre;
  usuario.apellidos = apellido;
  usuario.email = email;
  usuario.telefono = telefono;

  sessionStorage.setItem("usuarioRegistrado", JSON.stringify(usuario));

  edicionTemp = null;
  salirModoEdicion();
  renderizarVista();
}

function marcarError(inputId, msg) {
  const input = document.getElementById(inputId);
  input.classList.add("error");
  const span = document.createElement("span");
  span.className = "field-error";
  span.textContent = msg;
  input.insertAdjacentElement("afterend", span);
}

function limpiarErrores() {
  document.querySelectorAll(".field-error").forEach((el) => el.remove());
  CAMPOS_EDITABLES.forEach((id) =>
    document.getElementById(id).classList.remove("error"),
  );
}

// ───────────────────────────────────────────────────────────
// Mapa de edición de ubicación (mismo patrón que register.js)
// ───────────────────────────────────────────────────────────

function inicializarEdicionUbicacion() {
  if (!mapa) {
    mapa = L.map("mapEdit", { zoomControl: true }).setView(
      [-12.13, -77.02],
      13,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(mapa);
  } else {
    // El contenedor estuvo oculto (display:none) mientras no se editaba;
    // hay que recalcular su tamaño para que Leaflet pinte bien los tiles.
    setTimeout(() => mapa.invalidateSize(), 0);
  }

  document.getElementById("districtEdit").value = usuario.distrito || "";

  if (!datasetCargado) {
    setMapNoteEdit("Cargando dataset…", "loading");
    Papa.parse(CSV_DATASET, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (resultado) => {
        if (!resultado.data || !resultado.data.length) {
          setMapNoteEdit("⚠ Dataset vacío o no encontrado.", "error");
          return;
        }
        procesarDatasetEdit(resultado.data);
        datasetCargado = true;
      },
      error: () => {
        setMapNoteEdit(
          `⚠ No se encontró "${CSV_DATASET}". Ejecuta el notebook primero.`,
          "error",
        );
      },
    });
  } else {
    filtrarPorDistritoEdit();
  }
}

function procesarDatasetEdit(filas) {
  const vistos = new Set();

  filas.forEach((row) => {
    const oid = row.origen_id;
    if (oid && !vistos.has(oid)) {
      vistos.add(oid);
      todosLosNodos.push({
        id: oid,
        lat: parseFloat(row.origen_lat),
        lon: parseFloat(row.origen_lon),
        calle: row.calle || "Sin nombre",
        distrito: row.distrito_origen || "Otro",
      });
    }

    const did = row.destino_id;
    if (did && !vistos.has(did)) {
      vistos.add(did);
      todosLosNodos.push({
        id: did,
        lat: parseFloat(row.destino_lat),
        lon: parseFloat(row.destino_lon),
        calle: row.calle || "Sin nombre",
        distrito: row.distrito_destino || "Otro",
      });
    }
  });

  todosLosNodos = todosLosNodos.filter((n) => !isNaN(n.lat) && !isNaN(n.lon));
  filtrarPorDistritoEdit();
}

function filtrarPorDistritoEdit() {
  const distrito = document.getElementById("districtEdit").value;

  if (capaNodos) {
    mapa.removeLayer(capaNodos);
    capaNodos = null;
  }
  marcadorActivo = null;

  if (!distrito) {
    setMapNoteEdit("Selecciona un distrito para ver ubicaciones.", "ok");
    return;
  }

  const filtrados = todosLosNodos.filter((n) => n.distrito === distrito);

  if (!filtrados.length) {
    setMapNoteEdit(`No hay ubicaciones para "${distrito}".`, "error");
    return;
  }

  const iconoNormal = L.divIcon({
    className: "",
    html: `<div style="width:10px;height:10px;border-radius:50%;
               background:#E6A64B;border:2px solid #fff;
               box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });

  const iconoHover = L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;
               background:#d4872a;border:2px solid #fff;
               box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

  const iconoSeleccionado = L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;
               background:#E6A64B;border:3px solid #333;
               box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  const marcadores = filtrados.map((nodo) => {
    const m = L.marker([nodo.lat, nodo.lon], { icon: iconoNormal });
    m._nodoData = nodo;

    m.on("mouseover", function () {
      if (this !== marcadorActivo) this.setIcon(iconoHover);
    });
    m.on("mouseout", function () {
      if (this !== marcadorActivo) this.setIcon(iconoNormal);
    });
    m.on("click", function () {
      seleccionarMarcadorEdit(this, iconoSeleccionado, iconoNormal);
    });

    m.bindTooltip(
      `<b>${nodo.calle}</b><br>${nodo.distrito}<br>` +
        `${nodo.lat.toFixed(5)}, ${nodo.lon.toFixed(5)}`,
      { direction: "top", offset: [0, -8] },
    );

    return m;
  });

  capaNodos = L.layerGroup(marcadores).addTo(mapa);

  const grupo = L.featureGroup(marcadores);
  mapa.fitBounds(grupo.getBounds().pad(0.08));

  // Si la dirección actual del usuario pertenece a este distrito,
  // la dejamos marcada como seleccionada (sin contar como un cambio).
  const actual = marcadores.find(
    (m) =>
      m._nodoData.distrito === usuario.distrito &&
      Math.abs(m._nodoData.lat - parseFloat(usuario.latitud)) < 0.0005 &&
      Math.abs(m._nodoData.lon - parseFloat(usuario.longitud)) < 0.0005,
  );
  if (actual) {
    seleccionarMarcadorEdit(actual, iconoSeleccionado, iconoNormal, false);
    setMapNoteEdit(
      `${filtrados.length} ubicaciones en ${distrito}. Esta es tu dirección actual.`,
      "ok",
    );
  } else {
    setMapNoteEdit(
      `${filtrados.length} ubicaciones en ${distrito}. Haz clic en un marcador para cambiar tu dirección.`,
      "ok",
    );
  }
}

function seleccionarMarcadorEdit(
  marcador,
  iconoSel,
  iconoNormal,
  esCambio = true,
) {
  if (marcadorActivo && marcadorActivo !== marcador) {
    marcadorActivo.setIcon(iconoNormal);
  }
  marcadorActivo = marcador;
  marcador.setIcon(iconoSel);

  if (!esCambio) return;

  const nodo = marcador._nodoData;
  usuario.distrito = nodo.distrito;
  usuario.calle = nodo.calle;
  usuario.latitud = nodo.lat.toFixed(6);
  usuario.longitud = nodo.lon.toFixed(6);

  setMapNoteEdit(
    `✓ Nueva ubicación seleccionada: ${nodo.calle} (${nodo.distrito})`,
    "selected",
  );
}

function setMapNoteEdit(msg, tipo) {
  const el = document.getElementById("mapNoteEdit");
  if (!el) return;
  const colores = {
    loading: "#888",
    ok: "#2e7d32",
    error: "#c62828",
    selected: "#a06600",
  };
  el.textContent = msg;
  el.style.color = colores[tipo] || "#777";
}
