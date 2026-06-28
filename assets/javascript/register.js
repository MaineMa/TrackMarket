// ─────────────────────────────────────────────
//  register.js  —  TrackMarket
//  Lee TB1_1ACC0184_2026-10_Dataset.csv,
//  extrae nodos únicos y los pinta en Leaflet.
//  El usuario elige distrito → filtra marcadores
//  → hace clic → captura lat/lon/calle.
// ─────────────────────────────────────────────

const CSV_DATASET = "TB1_1ACC0184_2026-10_Dataset.csv";

// ── Estado global ──────────────────────────────
let mapa           = null;
let todosLosNodos  = [];   // [{lat, lon, calle, distrito, nodo_id}]
let capaNodos      = null; // LayerGroup activo
let marcadorActivo = null; // marcador seleccionado

// ── Inicialización ─────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
    iniciarMapa();
    cargarDataset();
    configurarFormulario();

    // Cuando cambia el distrito → refiltrar marcadores
    document.getElementById("district")
        .addEventListener("change", () => filtrarPorDistrito());
});

// ── Mapa ───────────────────────────────────────
function iniciarMapa() {
    mapa = L.map("map", { zoomControl: true }).setView([-12.13, -77.02], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
    }).addTo(mapa);
}

// ── Carga CSV con PapaParse ────────────────────
function cargarDataset() {
    setMapNote("Cargando dataset…", "loading");

    Papa.parse(CSV_DATASET, {
        download : true,
        header   : true,
        skipEmptyLines: true,
        complete : (result) => {
            if (!result.data || !result.data.length) {
                setMapNote("⚠ Dataset vacío o no encontrado.", "error");
                return;
            }
            procesarDataset(result.data);
        },
        error: () => {
            setMapNote(
                `⚠ No se encontró "${CSV_DATASET}". Ejecuta el notebook primero.`,
                "error"
            );
        },
    });
}

function procesarDataset(filas) {
    const nodosVistos = new Set();

    filas.forEach(row => {
        // Nodo origen
        const oid = row.origen_id;
        if (oid && !nodosVistos.has(oid)) {
            nodosVistos.add(oid);
            todosLosNodos.push({
                id      : oid,
                lat     : parseFloat(row.origen_lat),
                lon     : parseFloat(row.origen_lon),
                calle   : row.calle || "Sin nombre",
                distrito: row.distrito_origen || "Otro",
            });
        }

        // Nodo destino
        const did = row.destino_id;
        if (did && !nodosVistos.has(did)) {
            nodosVistos.add(did);
            todosLosNodos.push({
                id      : did,
                lat     : parseFloat(row.destino_lat),
                lon     : parseFloat(row.destino_lon),
                calle   : row.calle || "Sin nombre",
                distrito: row.distrito_destino || "Otro",
            });
        }
    });

    // Filtrar coordenadas inválidas
    todosLosNodos = todosLosNodos.filter(
        n => !isNaN(n.lat) && !isNaN(n.lon)
    );

    setMapNote(
        `${todosLosNodos.length.toLocaleString()} ubicaciones cargadas. ` +
        `Selecciona un distrito y haz clic en un marcador.`,
        "ok"
    );

    filtrarPorDistrito();
}

// ── Filtrar y pintar marcadores ────────────────
function filtrarPorDistrito() {
    const distrito = document.getElementById("district").value;

    // Limpiar capa anterior
    if (capaNodos) {
        mapa.removeLayer(capaNodos);
        capaNodos = null;
    }

    // Limpiar selección previa si cambió el distrito
    limpiarSeleccion();

    if (!distrito) return;

    const filtrados = todosLosNodos.filter(n => n.distrito === distrito);

    if (!filtrados.length) {
        setMapNote(`No hay ubicaciones para "${distrito}".`, "error");
        return;
    }

    // Íconos
    const iconoNormal = L.divIcon({
        className : "",
        html      : `<div style="
            width:10px;height:10px;border-radius:50%;
            background:#E6A64B;border:2px solid #fff;
            box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
        iconSize  : [10, 10],
        iconAnchor: [5, 5],
    });

    const iconoHover = L.divIcon({
        className : "",
        html      : `<div style="
            width:14px;height:14px;border-radius:50%;
            background:#d4872a;border:2px solid #fff;
            box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
        iconSize  : [14, 14],
        iconAnchor: [7, 7],
    });

    const iconoSeleccionado = L.divIcon({
        className : "",
        html      : `<div style="
            width:16px;height:16px;border-radius:50%;
            background:#E6A64B;border:3px solid #333;
            box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>`,
        iconSize  : [16, 16],
        iconAnchor: [8, 8],
    });

    const marcadores = filtrados.map(nodo => {
        const m = L.marker([nodo.lat, nodo.lon], { icon: iconoNormal });

        m._nodoData = nodo;

        m.on("mouseover", function () {
            if (this !== marcadorActivo)
                this.setIcon(iconoHover);
        });
        m.on("mouseout", function () {
            if (this !== marcadorActivo)
                this.setIcon(iconoNormal);
        });
        m.on("click", function () {
            seleccionarMarcador(this, iconoSeleccionado, iconoNormal);
        });

        m.bindTooltip(
            `<b>${nodo.calle}</b><br>${nodo.distrito}<br>` +
            `${nodo.lat.toFixed(5)}, ${nodo.lon.toFixed(5)}`,
            { direction: "top", offset: [0, -8] }
        );

        return m;
    });

    capaNodos = L.layerGroup(marcadores).addTo(mapa);

    // Centrar mapa en los marcadores del distrito
    const grupo = L.featureGroup(marcadores);
    mapa.fitBounds(grupo.getBounds().pad(0.08));

    setMapNote(
        `${filtrados.length.toLocaleString()} ubicaciones en ${distrito}. ` +
        `Haz clic en un marcador para seleccionarlo.`,
        "ok"
    );
}

// ── Selección de marcador ──────────────────────
function seleccionarMarcador(marcador, iconoSel, iconoNormal) {
    // Restaurar ícono del anterior seleccionado
    if (marcadorActivo && marcadorActivo !== marcador) {
        marcadorActivo.setIcon(iconoNormal);
    }

    marcadorActivo = marcador;
    marcador.setIcon(iconoSel);

    const nodo = marcador._nodoData;

    // Rellenar campos del formulario
    document.getElementById("street").value    = nodo.calle;
    document.getElementById("latitude").value  = nodo.lat.toFixed(6);
    document.getElementById("longitude").value = nodo.lon.toFixed(6);

    // Resaltar el campo de ubicación
    document.getElementById("street").classList.add("selected-location");

    setMapNote(
        `✓ Seleccionado: ${nodo.calle} (${nodo.distrito})`,
        "selected"
    );
}

function limpiarSeleccion() {
    marcadorActivo = null;
    document.getElementById("street").value    = "";
    document.getElementById("latitude").value  = "";
    document.getElementById("longitude").value = "";
    document.getElementById("street").classList.remove("selected-location");
}

// ── Nota del mapa ──────────────────────────────
function setMapNote(msg, tipo) {
    const el = document.querySelector(".map-note");
    if (!el) return;

    const colores = {
        loading : "#888",
        ok      : "#2e7d32",
        error   : "#c62828",
        selected: "#a06600",
    };

    el.textContent = msg;
    el.style.color = colores[tipo] || "#777";
}

// ── Formulario ─────────────────────────────────
function configurarFormulario() {
    const form = document.getElementById("registerForm");

    form.addEventListener("submit", function (e) {
        e.preventDefault();

        // Validar contraseñas
        const pwd  = document.getElementById("password").value;
        const pwd2 = document.getElementById("confirmPassword").value;

        if (pwd !== pwd2) {
            mostrarError("confirmPassword", "Las contraseñas no coinciden.");
            return;
        }

        // Validar email
        const email = document.getElementById("email").value;
        if (!email.includes("@")) {
            mostrarError("email", "Ingresa un correo válido.");
            return;
        }

        // Validar teléfono (9 dígitos)
        const tel = document.getElementById("phone").value;
        if (!/^\d{9}$/.test(tel)) {
            mostrarError("phone", "El teléfono debe tener 9 dígitos.");
            return;
        }

        // Validar que se eligió distrito
        const distrito = document.getElementById("district").value;
        if (!distrito) {
            mostrarError("district", "Selecciona un distrito.");
            return;
        }

        // Validar que se eligió ubicación en el mapa
        if (!document.getElementById("latitude").value) {
            setMapNote("⚠ Debes seleccionar una ubicación en el mapa.", "error");
            document.getElementById("map").scrollIntoView({ behavior: "smooth" });
            return;
        }

        // Todo OK → mostrar resumen (aquí podrías hacer fetch a tu backend)
        const datos = {
            nombre    : document.getElementById("name").value,
            apellidos : document.getElementById("lastname").value,
            email,
            telefono  : tel,
            distrito,
            calle     : document.getElementById("street").value,
            latitud   : document.getElementById("latitude").value,
            longitud  : document.getElementById("longitude").value,
        };

        mostrarExito(datos);
    });

    // Limpiar errores al escribir
    ["name","lastname","email","password","confirmPassword","phone"].forEach(id => {
        document.getElementById(id)
            .addEventListener("input", () => limpiarError(id));
    });
}

function mostrarError(inputId, msg) {
    limpiarError(inputId);
    const input = document.getElementById(inputId);
    input.style.borderColor = "#c62828";
    const span = document.createElement("span");
    span.className   = "field-error";
    span.textContent = msg;
    span.style.cssText = "font-size:12px;color:#c62828;margin-top:4px;display:block";
    input.insertAdjacentElement("afterend", span);
    input.focus();
}

function limpiarError(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.style.borderColor = "";
    const next = input.nextElementSibling;
    if (next && next.classList.contains("field-error")) next.remove();
}

function mostrarExito(datos) {
    // Eliminar toast previo si existe
    const prev = document.getElementById("success-toast");
    if (prev) prev.remove();

    const toast = document.createElement("div");
    toast.id = "success-toast";
    toast.innerHTML = `
        <strong>✓ Cuenta creada correctamente</strong><br>
        <small style="opacity:.85">
            ${datos.nombre} ${datos.apellidos} — ${datos.email}<br>
            📍 ${datos.calle}, ${datos.distrito}
            (${datos.latitud}, ${datos.longitud})
        </small>
    `;
    Object.assign(toast.style, {
        position     : "fixed",
        bottom       : "28px",
        right        : "28px",
        background   : "#2e7d32",
        color        : "#fff",
        padding      : "16px 20px",
        borderRadius : "12px",
        fontSize     : "14px",
        lineHeight   : "1.6",
        boxShadow    : "0 4px 16px rgba(0,0,0,.2)",
        zIndex       : "9999",
        maxWidth     : "360px",
        animation    : "fadeInUp .3s ease",
    });

    document.body.appendChild(toast);

    // Auto-cerrar en 5 s
    setTimeout(() => toast.remove(), 5000);
}