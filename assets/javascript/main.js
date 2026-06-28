const CSV_RESTAURANTES = "restaurants.csv";
const CSV_PRODUCTOS    = "products.csv";

const form     = document.getElementById("loginForm");
const email    = document.getElementById("email");
const password = document.getElementById("password");

email.addEventListener("input", function () {
    email.setCustomValidity("");
});

password.addEventListener("input", function () {
    password.setCustomValidity("");
});

form.addEventListener("submit", async function (e) {
    e.preventDefault();

    email.setCustomValidity("");
    password.setCustomValidity("");

    if (!email.value.includes("@gmail.com")) {
        email.setCustomValidity("Ingrese un correo válido con @gmail.com");
        email.reportValidity();
        return;
    }

    if (password.value.length < 5) {
        password.setCustomValidity("La contraseña debe tener mínimo 5 caracteres");
        password.reportValidity();
        return;
    }

    const btn = form.querySelector("button[type=submit]");
    btn.disabled    = true;
    btn.textContent = "Verificando datos…";

    const { ok, faltantes } = await verificarCSVs();

    if (!ok) {
        btn.disabled    = false;
        btn.textContent = "Iniciar Sesión";
        mostrarErrorCSV(faltantes);
        return;
    }

    // Todo bien → redirigir
    window.location.href = "restaurants.html";
});

async function verificarCSVs() {
    const archivos  = [CSV_RESTAURANTES, CSV_PRODUCTOS];
    const faltantes = [];

    await Promise.all(
        archivos.map(async (archivo) => {
            try {
                const res = await fetch(archivo, { method: "HEAD" });
                if (!res.ok) faltantes.push(archivo);
            } catch (_) {
                faltantes.push(archivo);
            }
        })
    );

    return { ok: faltantes.length === 0, faltantes };
}

function mostrarErrorCSV(faltantes) {
    const previo = document.getElementById("csv-warning");
    if (previo) previo.remove();

    const nombres = faltantes.join(" y ");
    const comandos = faltantes
        .map(f => f === CSV_RESTAURANTES
            ? "restaurants.py"
            : "products.py")
        .join("<br>");

    const div = document.createElement("div");
    div.id = "csv-warning";
    div.innerHTML = `
        <p style="font-weight:600;margin-bottom:4px">
            Datos no encontrados
        </p>
        <p style="margin-bottom:8px">
            Falta: <strong>${nombres}</strong>
        </p>
        <p style="margin-bottom:4px">Ejecuta en tu terminal:</p>
        <code>${comandos}</code>
    `;
    Object.assign(div.style, {
        marginTop   : "14px",
        background  : "#FFF3DC",
        border      : "1px solid #f0c060",
        borderRadius: "8px",
        padding     : "12px 14px",
        fontSize    : "12px",
        color       : "#7a4f00",
        lineHeight  : "1.7",
    });
    div.querySelector("code").style.cssText =
        "display:block;background:#ffe8a0;padding:6px 8px;" +
        "border-radius:5px;font-size:11px;margin-top:4px;color:#5a3800";

    form.insertAdjacentElement("afterend", div);
}