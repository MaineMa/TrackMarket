const CSV_DATASET = "../csvs/TB1_1ACC0184_2026-10_Dataset.csv";

let mapa = null;
let marcadorEntrega = null;
let ordenActual = null;

window.addEventListener("DOMContentLoaded", () => {
  iniciar();
});

async function iniciar() {
  const idOrden = new URLSearchParams(window.location.search).get("id");

  if (!idOrden) {
    mostrarError("No se especificó ningún pedido en la URL (falta ?id=).");
    return;
  }

  const orden = buscarOrden(idOrden);
  if (!orden) {
    mostrarError(`No se encontró el pedido #${idOrden} en esta sesión.`);
    return;
  }

  if (
    !orden.origen ||
    orden.origen.lat == null ||
    isNaN(orden.origen.lat) ||
    !orden.destino ||
    orden.destino.lat == null ||
    isNaN(orden.destino.lat)
  ) {
    mostrarError(
      "Este pedido no tiene coordenadas de dirección/restaurante suficientes para calcular la ruta.",
    );
    return;
  }

  ordenActual = orden;
  document.getElementById("pedidoIdLabel").textContent = "Pedido #" + orden.id;
  renderizarPanelPedido(orden);

  // ── 1) Cargar el dataset completo ──────────────────────────
  actualizarCarga("Cargando direcciones del dataset…");
  let filas;
  try {
    filas = await cargarDataset();
  } catch (e) {
    mostrarError(
      'No se pudo cargar "' +
        CSV_DATASET +
        '". Verifica que el archivo exista y recarga la página.',
    );
    return;
  }

  // ── 2) Construir el grafo (no dirigido) ────────────────────
  actualizarCarga("Construyendo el grafo vial…");
  const { grafo, nodosCoord } = construirGrafo(filas);

  // ── 3) Ubicar los nodos más cercanos a casa y tienda ───────
  actualizarCarga("Calculando la ruta óptima (UCS)…");
  const nodoInicio = nodoMasCercano(
    nodosCoord,
    orden.origen.lat,
    orden.origen.lon,
  );
  const nodoMeta = nodoMasCercano(
    nodosCoord,
    orden.destino.lat,
    orden.destino.lon,
  );

  if (!nodoInicio || !nodoMeta) {
    mostrarError(
      "No se encontraron nodos del grafo cerca de las coordenadas del pedido.",
    );
    return;
  }

  const resultadoUCS = busquedaCostoUniforme(grafo, nodoInicio, nodoMeta);

  if (!resultadoUCS) {
    mostrarError(
      "No se encontró una ruta posible entre tu dirección y el restaurante dentro del grafo vial.",
    );
    return;
  }

  // ── 4) Mostrar mapa con casa/tienda resaltados ─────────────
  ocultarCarga();
  inicializarMapa(orden);

  const yaCompletada = orden.estado === "Completada";

  if (!yaCompletada) {
    document.getElementById("entregaCard").style.display = "block";
  }

  // ── 5) Animación de exploración UCS (una sola vez) ─────────
  await animarExploracionUCS(resultadoUCS, nodosCoord);

  // ── 6) Ruta final + resumen ─────────────────────────────────
  dibujarRutaFinal(resultadoUCS, nodosCoord);
  actualizarPanelUCS(resultadoUCS);

  if (yaCompletada) {
    document.getElementById("estadoEntrega").parentElement.style.display =
      "none";
    document.getElementById("pasoUCS").textContent =
      "Pedido entregado" +
      (orden.fechaEntrega ? " el " + formatearFecha(orden.fechaEntrega) : "") +
      ".";
    return;
  }

  // ── 7) Fijar la hora de salida UNA SOLA VEZ (la primera vez que
  //       el pedido empieza a viajar). Si ya tenía horaSalida (porque
  //       el usuario salió y volvió a entrar), no se reinicia: el
  //       reloj real sigue corriendo aunque la pantalla esté cerrada,
  //       igual que una entrega de verdad. ─────────────────────────
  if (!orden.horaSalida) {
    orden.estado = "En camino";
    orden.horaSalida = new Date().toISOString();
    actualizarOrdenEnProceso(orden);
  }

  const transcurridoPrevioS =
    (Date.now() - new Date(orden.horaSalida).getTime()) / 1000;

  // ── 8) Si ya pasó suficiente tiempo real mientras no estabas
  //       viendo la pantalla, el pedido ya debería haber llegado:
  //       no repetimos el viaje, solo lo damos por entregado. ─────
  if (transcurridoPrevioS >= resultadoUCS.costoTotal) {
    const casa = nodosCoord.get(resultadoUCS.camino[0]);
    marcadorEntrega = L.marker([casa.lat, casa.lon], {
      icon: iconoRepartidor(),
    }).addTo(mapa);
    finalizarPedido(orden);
    mostrarEntregaCompletada(
      "¡Tu pedido ya llegó mientras no estabas viendo esta pantalla! 🎉",
    );
    return;
  }

  // ── 9) Recorrido en tiempo real (asíncrono, 1 segundo real
  //       por cada segundo de tiempo_estimado_s), retomando desde
  //       el punto en que ya debería estar según el tiempo real
  //       transcurrido. ───────────────────────────────────────────
  await animarRecorridoTiempoReal(
    resultadoUCS,
    nodosCoord,
    transcurridoPrevioS,
  );

  // ── 10) Finalizar pedido ─────────────────────────────────────
  finalizarPedido(orden);
  mostrarEntregaCompletada("¡Tu pedido ha llegado! 🎉");
}

// ───────────────────────────────────────────────────────────
// Carga y parseo del dataset
// ───────────────────────────────────────────────────────────

function cargarDataset() {
  return new Promise((resolve, reject) => {
    Papa.parse(CSV_DATASET, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (resultado) => {
        if (!resultado.data || !resultado.data.length) {
          reject(new Error("Dataset vacío"));
          return;
        }
        resolve(resultado.data);
      },
      error: (err) => reject(err),
    });
  });
}

// ───────────────────────────────────────────────────────────
// Grafo NO DIRIGIDO: cada fila del dataset representa una calle
// transitable en ambos sentidos, así que se agregan los dos
// arcos (origen→destino y destino→origen) con el mismo costo.
// Esto evita "callejones sin salida" cuando la dirección elegida
// por el usuario en el registro corresponde a un nodo que en el
// dataset original solo aparece como destino.
// ───────────────────────────────────────────────────────────

function construirGrafo(filas) {
  const grafo = new Map(); // id -> [{destino, peso, distancia_m, calle}]
  const nodosCoord = new Map(); // id -> {lat, lon}

  function agregarArco(origenId, destinoId, lat, lon, peso, distanciaM, calle) {
    if (!grafo.has(origenId)) grafo.set(origenId, []);
    grafo.get(origenId).push({
      destino: destinoId,
      peso,
      distancia_m: distanciaM,
      calle: calle || "Sin nombre",
    });
  }

  filas.forEach((fila) => {
    const oId = fila.origen_id;
    const dId = fila.destino_id;
    const oLat = parseFloat(fila.origen_lat);
    const oLon = parseFloat(fila.origen_lon);
    const dLat = parseFloat(fila.destino_lat);
    const dLon = parseFloat(fila.destino_lon);
    const peso = parseFloat(fila.tiempo_estimado_s);
    const distanciaM = parseFloat(fila.distancia_m) || 0;

    if (!oId || !dId || isNaN(peso) || isNaN(oLat) || isNaN(dLat)) return;

    if (!nodosCoord.has(oId)) nodosCoord.set(oId, { lat: oLat, lon: oLon });
    if (!nodosCoord.has(dId)) nodosCoord.set(dId, { lat: dLat, lon: dLon });

    agregarArco(oId, dId, oLat, oLon, peso, distanciaM, fila.calle);
    agregarArco(dId, oId, dLat, dLon, peso, distanciaM, fila.calle);
  });

  return { grafo, nodosCoord };
}

function distanciaHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nodoMasCercano(nodosCoord, lat, lon) {
  let mejorId = null;
  let mejorDist = Infinity;
  nodosCoord.forEach((coord, id) => {
    const dist = distanciaHaversine(lat, lon, coord.lat, coord.lon);
    if (dist < mejorDist) {
      mejorDist = dist;
      mejorId = id;
    }
  });
  return mejorId;
}

// ───────────────────────────────────────────────────────────
// Búsqueda de Costo Uniforme (UCS) — equivalente a Dijkstra con
// pesos no negativos (tiempo_estimado_s). Se detiene en cuanto
// se asienta el nodo meta y registra el orden de exploración
// para poder animarlo después.
// ───────────────────────────────────────────────────────────

function busquedaCostoUniforme(grafo, inicioId, metaId) {
  const costos = new Map([[inicioId, 0]]);
  const previos = new Map();
  const aristaPrevia = new Map();
  const visitados = new Set();
  const ordenExploracion = [];

  const cola = [{ id: inicioId, costo: 0 }];

  while (cola.length) {
    cola.sort((a, b) => a.costo - b.costo);
    const actual = cola.shift();

    if (visitados.has(actual.id)) continue;
    visitados.add(actual.id);
    ordenExploracion.push(actual.id);

    if (actual.id === metaId) break;

    const vecinos = grafo.get(actual.id) || [];
    for (const arista of vecinos) {
      if (visitados.has(arista.destino)) continue;
      const nuevoCosto = actual.costo + arista.peso;
      if (
        !costos.has(arista.destino) ||
        nuevoCosto < costos.get(arista.destino)
      ) {
        costos.set(arista.destino, nuevoCosto);
        previos.set(arista.destino, actual.id);
        aristaPrevia.set(arista.destino, arista);
        cola.push({ id: arista.destino, costo: nuevoCosto });
      }
    }
  }

  if (!visitados.has(metaId)) return null;

  const camino = [metaId];
  const aristas = [];
  let actId = metaId;
  while (actId !== inicioId) {
    aristas.unshift(aristaPrevia.get(actId));
    actId = previos.get(actId);
    camino.unshift(actId);
  }

  return {
    camino,
    aristas,
    costoTotal: costos.get(metaId),
    ordenExploracion,
  };
}

// ───────────────────────────────────────────────────────────
// Órdenes en sessionStorage
// ───────────────────────────────────────────────────────────

function buscarOrden(id) {
  const enProceso = JSON.parse(
    sessionStorage.getItem("ordenesEnProceso") || "[]",
  );
  let orden = enProceso.find((o) => o.id === id);
  if (orden) return orden;

  const completadas = JSON.parse(
    sessionStorage.getItem("ordenesCompletadas") || "[]",
  );
  orden = completadas.find((o) => o.id === id);
  return orden || null;
}

function actualizarOrdenEnProceso(orden) {
  const ordenes = JSON.parse(
    sessionStorage.getItem("ordenesEnProceso") || "[]",
  );
  const idx = ordenes.findIndex((o) => o.id === orden.id);
  if (idx !== -1) {
    ordenes[idx] = { ...ordenes[idx], ...orden };
    sessionStorage.setItem("ordenesEnProceso", JSON.stringify(ordenes));
  }
}

function finalizarPedido(orden) {
  let ordenesProceso = JSON.parse(
    sessionStorage.getItem("ordenesEnProceso") || "[]",
  );
  ordenesProceso = ordenesProceso.filter((o) => o.id !== orden.id);
  sessionStorage.setItem("ordenesEnProceso", JSON.stringify(ordenesProceso));

  const ordenesCompletadas = JSON.parse(
    sessionStorage.getItem("ordenesCompletadas") || "[]",
  );
  orden.estado = "Completada";
  orden.fechaEntrega = new Date().toISOString();
  ordenesCompletadas.push(orden);
  sessionStorage.setItem(
    "ordenesCompletadas",
    JSON.stringify(ordenesCompletadas),
  );
}

function mostrarEntregaCompletada(mensaje) {
  document.getElementById("estadoEntrega").textContent = mensaje;
  document.getElementById("progresoTramo").textContent = "";
  document.getElementById("tiempoRestante").textContent = "";

  const volver = document.createElement("button");
  volver.className = "btn-volver";
  volver.style.marginTop = "10px";
  volver.textContent = "Ver en Mis Compras";
  volver.onclick = () => volverAOrders();
  document.getElementById("entregaCard").appendChild(volver);
}

// ───────────────────────────────────────────────────────────
// UI: estados de carga / error / panel de pedido
// ───────────────────────────────────────────────────────────

function actualizarCarga(msg) {
  document.getElementById("cargaMsg").textContent = msg;
}

function ocultarCarga() {
  document.getElementById("estadoCarga").style.display = "none";
  document.getElementById("contenido").style.display = "grid";
  document.getElementById("footerNote").style.display = "block";
}

function mostrarError(msg) {
  document.getElementById("estadoCarga").style.display = "none";
  document.getElementById("estadoError").style.display = "flex";
  document.getElementById("errorMsg").textContent = msg;
}

function renderizarPanelPedido(orden) {
  document.getElementById("pedidoTitulo").textContent =
    "Pedido #" + orden.id + (orden.destino ? " · " + orden.destino.nombre : "");

  const cont = document.getElementById("pedidoProductos");
  cont.innerHTML = (orden.productos || [])
    .map((p) => {
      const precio = parseFloat(p.precio_soles) || 0;
      const cant = p.cantidad || 1;
      return `
        <div class="pedido-prod-row">
          <span>${esc(p.nombre_producto || "Producto")} ×${cant}</span>
          <span>S/ ${(precio * cant).toFixed(2)}</span>
        </div>`;
    })
    .join("");

  document.getElementById("pedidoTotal").textContent =
    "S/ " + (parseFloat(orden.total) || 0).toFixed(2);
}

// ───────────────────────────────────────────────────────────
// Mapa (Leaflet + OpenStreetMap)
// ───────────────────────────────────────────────────────────

function iconoCasa() {
  return L.divIcon({
    className: "",
    html: `<div class="map-icon casa">🏠</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function iconoTienda() {
  return L.divIcon({
    className: "",
    html: `<div class="map-icon tienda">🛒</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function iconoRepartidor() {
  return L.divIcon({
    className: "",
    html: `<div class="map-icon repartidor">🛵</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function iconoExplorado() {
  return L.divIcon({
    className: "",
    html: `<div class="map-icon explorado"></div>`,
    iconSize: [9, 9],
    iconAnchor: [4, 4],
  });
}

function inicializarMapa(orden) {
  mapa = L.map("map", { zoomControl: true });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(mapa);

  L.marker([orden.origen.lat, orden.origen.lon], { icon: iconoCasa() })
    .addTo(mapa)
    .bindTooltip(
      "Tu dirección" + (orden.direccion ? ": " + orden.direccion : ""),
      {
        direction: "top",
        offset: [0, -10],
      },
    );

  L.marker([orden.destino.lat, orden.destino.lon], { icon: iconoTienda() })
    .addTo(mapa)
    .bindTooltip(orden.destino.nombre || "Restaurante", {
      direction: "top",
      offset: [0, -10],
    });

  const bounds = L.latLngBounds([
    [orden.origen.lat, orden.origen.lon],
    [orden.destino.lat, orden.destino.lon],
  ]);
  mapa.fitBounds(bounds.pad(0.25));
}

// ───────────────────────────────────────────────────────────
// Animación: exploración del algoritmo UCS (una sola vez)
// ───────────────────────────────────────────────────────────

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function animarExploracionUCS(resultadoUCS, nodosCoord) {
  const capa = L.layerGroup().addTo(mapa);
  const nodos = resultadoUCS.ordenExploracion;

  const DURACION_TOTAL_MS = 2500;
  const delay = Math.min(120, Math.max(4, DURACION_TOTAL_MS / nodos.length));

  for (let i = 0; i < nodos.length; i++) {
    const coord = nodosCoord.get(nodos[i]);
    if (coord) {
      L.marker([coord.lat, coord.lon], { icon: iconoExplorado() }).addTo(capa);
    }
    document.getElementById("pasoUCS").textContent =
      `Explorando el grafo… nodo ${i + 1} / ${nodos.length}`;
    if (i % Math.max(1, Math.floor(nodos.length / 60)) === 0) {
      await esperar(delay);
    }
  }
}

function dibujarRutaFinal(resultadoUCS, nodosCoord) {
  const puntos = resultadoUCS.camino.map((id) => {
    const c = nodosCoord.get(id);
    return [c.lat, c.lon];
  });
  L.polyline(puntos, { color: "#1d8a4e", weight: 5, opacity: 0.9 }).addTo(mapa);
}

function actualizarPanelUCS(resultadoUCS) {
  const calles = [];
  resultadoUCS.aristas.forEach((a) => {
    if (!calles.length || calles[calles.length - 1] !== a.calle) {
      calles.push(a.calle);
    }
  });

  document.getElementById("pasoUCS").textContent =
    `Ruta óptima encontrada (${resultadoUCS.ordenExploracion.length} nodos explorados).`;
  document.getElementById("rutaResumen").textContent =
    "Por: " + calles.join(" → ");
  document.getElementById("costoTotalLine").style.display = "block";
  document.getElementById("costoTotal").textContent = formatearDuracion(
    resultadoUCS.costoTotal,
  );
}

// ───────────────────────────────────────────────────────────
// Recorrido en tiempo real: cada arista demora exactamente
// arista.peso segundos REALES (tiempo_estimado_s del dataset).
// El repartidor recorre la ruta desde la tienda hacia la casa.
// ───────────────────────────────────────────────────────────

function calcularPuntoEnRuta(aristas, transcurridoS) {
  let acumulado = 0;
  for (let i = 0; i < aristas.length; i++) {
    const dur = aristas[i].peso;
    if (acumulado + dur > transcurridoS) {
      return { indiceArista: i, offsetS: transcurridoS - acumulado };
    }
    acumulado += dur;
  }
  return { indiceArista: aristas.length, offsetS: 0 };
}

async function animarRecorridoTiempoReal(
  resultadoUCS,
  nodosCoord,
  transcurridoPrevioS = 0,
) {
  const camino = resultadoUCS.camino.slice().reverse(); // tienda → casa
  const aristas = resultadoUCS.aristas.slice().reverse();
  const totalSegundos = resultadoUCS.costoTotal;

  const { indiceArista, offsetS } = calcularPuntoEnRuta(
    aristas,
    transcurridoPrevioS,
  );

  const restanteInicialS = Math.max(0, totalSegundos - transcurridoPrevioS);
  document.getElementById("estadoEntrega").textContent =
    (transcurridoPrevioS > 0
      ? "Tu pedido sigue en camino. "
      : "Tu pedido va en camino. ") +
    "Tiempo restante estimado: " +
    formatearDuracion(restanteInicialS);

  let coordInicial;
  if (offsetS > 0 && indiceArista < aristas.length) {
    const desde = nodosCoord.get(camino[indiceArista]);
    const hasta = nodosCoord.get(camino[indiceArista + 1]);
    const t = offsetS / aristas[indiceArista].peso;
    coordInicial = {
      lat: desde.lat + (hasta.lat - desde.lat) * t,
      lon: desde.lon + (hasta.lon - desde.lon) * t,
    };
  } else {
    const idx = Math.min(indiceArista, camino.length - 1);
    coordInicial = nodosCoord.get(camino[idx]);
  }

  marcadorEntrega = L.marker([coordInicial.lat, coordInicial.lon], {
    icon: iconoRepartidor(),
  }).addTo(mapa);

  const inicioReal = Date.now() - transcurridoPrevioS * 1000;

  for (let i = indiceArista; i < aristas.length; i++) {
    const arista = aristas[i];
    const esTramoDeRetomada = i === indiceArista && offsetS > 0;
    const desde = esTramoDeRetomada ? coordInicial : nodosCoord.get(camino[i]);
    const hasta = nodosCoord.get(camino[i + 1]);
    const restanteDeEstaArista = esTramoDeRetomada
      ? arista.peso - offsetS
      : arista.peso;
    const duracionMs = Math.max(50, restanteDeEstaArista * 1000);

    document.getElementById("progresoTramo").textContent =
      `Tramo ${i + 1} / ${aristas.length} · por ${arista.calle}`;

    await moverMarcador(marcadorEntrega, desde, hasta, duracionMs);

    const transcurridoS = (Date.now() - inicioReal) / 1000;
    const restanteS = Math.max(0, totalSegundos - transcurridoS);
    document.getElementById("tiempoRestante").textContent =
      "Tiempo restante estimado: " + formatearDuracion(restanteS);
  }
}

function moverMarcador(marcador, desde, hasta, duracionMs) {
  return new Promise((resolve) => {
    const inicio = performance.now();
    function paso(ahora) {
      const t = Math.min(1, (ahora - inicio) / duracionMs);
      const lat = desde.lat + (hasta.lat - desde.lat) * t;
      const lon = desde.lon + (hasta.lon - desde.lon) * t;
      marcador.setLatLng([lat, lon]);
      if (t < 1) {
        requestAnimationFrame(paso);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(paso);
  });
}

// ───────────────────────────────────────────────────────────
// Utilidades
// ───────────────────────────────────────────────────────────

function formatearDuracion(segundos) {
  const s = Math.round(segundos);
  if (s < 60) return s + " s";
  const m = Math.floor(s / 60);
  const resto = s % 60;
  return m + " min " + resto + " s";
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

function volverAOrders() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "orders.html";
  }
}
