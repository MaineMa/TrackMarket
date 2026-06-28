const CSV_DATASET = "TB1_1ACC0184_2026-10_Dataset.csv";
const SERVER_URL  = "http://localhost:5000";

let mapa           = null;
let todosLosNodos  = [];
let capaNodos      = null;
let marcadorActivo = null;

window.addEventListener("DOMContentLoaded", () => {
    iniciarMapa();
    cargarDataset();
    configurarFormulario();
    configurarTelefono();
    document.getElementById("district")
        .addEventListener("change", () => filtrarPorDistrito());
});

function configurarTelefono() {
    const tel = document.getElementById("phone");
    tel.addEventListener("keypress", function (e) {
        if (!/[0-9]/.test(e.key)) e.preventDefault();
    });
    tel.addEventListener("input", function () {
        this.value = this.value.replace(/\D/g, "").slice(0, 9);
    });
    tel.addEventListener("paste", function (e) {
        e.preventDefault();
        const pegado = (e.clipboardData || window.clipboardData)
            .getData("text").replace(/\D/g, "").slice(0, 9);
        this.value = pegado;
    });
}

function iniciarMapa() {
    mapa = L.map("map", { zoomControl: true }).setView([-12.13, -77.02], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
    }).addTo(mapa);
}

function cargarDataset() {
    setMapNote("Cargando dataset…", "loading");
    Papa.parse(CSV_DATASET, {
        download: true, header: true, skipEmptyLines: true,
        complete: (result) => {
            if (!result.data || !result.data.length) {
                setMapNote("⚠ Dataset vacío o no encontrado.", "error");
                return;
            }
            procesarDataset(result.data);
        },
        error: () => {
            setMapNote(`⚠ No se encontró "${CSV_DATASET}". Ejecuta el notebook primero.`, "error");
        },
    });
}

function procesarDataset(filas) {
    const nodosVistos = new Set();
    filas.forEach(row => {
        const oid = row.origen_id;
        if (oid && !nodosVistos.has(oid)) {
            nodosVistos.add(oid);
            todosLosNodos.push({ id: oid, lat: parseFloat(row.origen_lat), lon: parseFloat(row.origen_lon), calle: row.calle || "Sin nombre", distrito: row.distrito_origen || "Otro" });
        }
        const did = row.destino_id;
        if (did && !nodosVistos.has(did)) {
            nodosVistos.add(did);
            todosLosNodos.push({ id: did, lat: parseFloat(row.destino_lat), lon: parseFloat(row.destino_lon), calle: row.calle || "Sin nombre", distrito: row.distrito_destino || "Otro" });
        }
    });
    todosLosNodos = todosLosNodos.filter(n => !isNaN(n.lat) && !isNaN(n.lon));
    setMapNote(`${todosLosNodos.length.toLocaleString()} ubicaciones cargadas. Selecciona un distrito y haz clic en un marcador.`, "ok");
    filtrarPorDistrito();
}

function filtrarPorDistrito() {
    const distrito = document.getElementById("district").value;
    if (capaNodos) { mapa.removeLayer(capaNodos); capaNodos = null; }
    limpiarSeleccion();
    if (!distrito) return;
    const filtrados = todosLosNodos.filter(n => n.distrito === distrito);
    if (!filtrados.length) { setMapNote(`No hay ubicaciones para "${distrito}".`, "error"); return; }

    const iconoNormal = L.divIcon({ className: "", html: `<div style="width:10px;height:10px;border-radius:50%;background:#E6A64B;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`, iconSize: [10,10], iconAnchor: [5,5] });
    const iconoHover  = L.divIcon({ className: "", html: `<div style="width:14px;height:14px;border-radius:50%;background:#d4872a;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`, iconSize: [14,14], iconAnchor: [7,7] });
    const iconoSel    = L.divIcon({ className: "", html: `<div style="width:16px;height:16px;border-radius:50%;background:#E6A64B;border:3px solid #333;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>`, iconSize: [16,16], iconAnchor: [8,8] });

    const marcadores = filtrados.map(nodo => {
        const m = L.marker([nodo.lat, nodo.lon], { icon: iconoNormal });
        m._nodoData = nodo;
        m.on("mouseover", function () { if (this !== marcadorActivo) this.setIcon(iconoHover); });
        m.on("mouseout",  function () { if (this !== marcadorActivo) this.setIcon(iconoNormal); });
        m.on("click",     function () { seleccionarMarcador(this, iconoSel, iconoNormal); });
        m.bindTooltip(`<b>${nodo.calle}</b><br>${nodo.distrito}<br>${nodo.lat.toFixed(5)}, ${nodo.lon.toFixed(5)}`, { direction: "top", offset: [0,-8] });
        return m;
    });

    capaNodos = L.layerGroup(marcadores).addTo(mapa);
    mapa.fitBounds(L.featureGroup(marcadores).getBounds().pad(0.08));
    setMapNote(`${filtrados.length.toLocaleString()} ubicaciones en ${distrito}. Haz clic en un marcador para seleccionarlo.`, "ok");
}

function seleccionarMarcador(marcador, iconoSel, iconoNormal) {
    if (marcadorActivo && marcadorActivo !== marcador) marcadorActivo.setIcon(iconoNormal);
    marcadorActivo = marcador;
    marcador.setIcon(iconoSel);
    const nodo = marcador._nodoData;
    document.getElementById("street").value    = nodo.calle;
    document.getElementById("latitude").value  = nodo.lat.toFixed(6);
    document.getElementById("longitude").value = nodo.lon.toFixed(6);
    document.getElementById("street").classList.add("selected-location");
    setMapNote(`✓ Seleccionado: ${nodo.calle} (${nodo.distrito})`, "selected");
}

function limpiarSeleccion() {
    marcadorActivo = null;
    document.getElementById("street").value    = "";
    document.getElementById("latitude").value  = "";
    document.getElementById("longitude").value = "";
    document.getElementById("street").classList.remove("selected-location");
}

function setMapNote(msg, tipo) {
    const el = document.querySelector(".map-note");
    if (!el) return;
    const colores = { loading:"#888", ok:"#2e7d32", error:"#c62828", selected:"#a06600" };
    el.textContent = msg;
    el.style.color = colores[tipo] || "#777";
}

function configurarFormulario() {
    document.getElementById("btn-register").addEventListener("click", async function () {
        const pwd  = document.getElementById("password").value;
        const pwd2 = document.getElementById("confirmPassword").value;
        if (pwd !== pwd2) { mostrarError("confirmPassword", "Las contraseñas no coinciden."); return; }

        const email = document.getElementById("email").value;
        if (!email.includes("@")) { mostrarError("email", "Ingresa un correo válido."); return; }

        const tel = document.getElementById("phone").value;
        if (!/^\d{9}$/.test(tel)) { mostrarError("phone", "El teléfono debe tener exactamente 9 dígitos."); return; }

        const distrito = document.getElementById("district").value;
        if (!distrito) { mostrarError("district", "Selecciona un distrito."); return; }

        if (!document.getElementById("latitude").value) {
            setMapNote("⚠ Debes seleccionar una ubicación en el mapa.", "error");
            document.getElementById("map").scrollIntoView({ behavior: "smooth" });
            return;
        }

        const datos = {
            nombre   : document.getElementById("name").value.trim(),
            apellidos: document.getElementById("lastname").value.trim(),
            email    : email.trim(),
            password : pwd,
            telefono : tel,
            distrito,
            calle    : document.getElementById("street").value,
            latitud  : document.getElementById("latitude").value,
            longitud : document.getElementById("longitude").value,
        };

        const btn = document.getElementById("btn-register");
        btn.disabled    = true;
        btn.textContent = "Guardando…";

        try {
            const res  = await fetch(`${SERVER_URL}/register`, {
                method : "POST",
                headers: { "Content-Type": "application/json" },
                body   : JSON.stringify(datos),
            });
            const json = await res.json();

            if (!res.ok || !json.ok) {
                btn.disabled    = false;
                btn.textContent = "Crear Cuenta";
                mostrarToast(json.error || "Error al guardar.", "error");
                return;
            }

            sessionStorage.setItem("usuario_actual", JSON.stringify(json));

            // Toast pequeño y redirige en 300ms
            mostrarToast("✓ Cuenta creada correctamente", "ok");
            setTimeout(() => { window.location.href = "restaurants.html"; }, 300);

        } catch (err) {
            btn.disabled    = false;
            btn.textContent = "Crear Cuenta";
            mostrarToast("No se pudo conectar al servidor. ¿Está corriendo register_server.py?", "error");
        }
    });

    ["name","lastname","email","password","confirmPassword","phone"].forEach(id => {
        document.getElementById(id).addEventListener("input", () => limpiarError(id));
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

function mostrarToast(msg, tipo) {
    const prev = document.getElementById("tm-toast");
    if (prev) prev.remove();

    const toast = document.createElement("div");
    toast.id = "tm-toast";
    toast.textContent = msg;
    toast.style.cssText = `
        position:fixed;
        bottom:28px;
        left:50%;
        transform:translateX(-50%);
        background:${tipo === "ok" ? "#2e7d32" : "#c62828"};
        color:#fff;
        padding:12px 24px;
        border-radius:8px;
        font-size:14px;
        font-weight:600;
        box-shadow:0 4px 16px rgba(0,0,0,.2);
        z-index:9999;
    `;
    document.body.appendChild(toast);
}