const form     = document.getElementById("loginForm");
const email    = document.getElementById("email");
const password = document.getElementById("password");

email.addEventListener("input", function () {
    email.setCustomValidity("");
});

password.addEventListener("input", function () {
    password.setCustomValidity("");
});

form.addEventListener("submit", function (e) {
    e.preventDefault();

    email.setCustomValidity("");
    password.setCustomValidity("");

    if (!email.value.includes("@")) {
        email.setCustomValidity("Ingresa un correo válido.");
        email.reportValidity();
        return;
    }

    if (password.value.length < 5) {
        password.setCustomValidity("La contraseña debe tener mínimo 5 caracteres");
        password.reportValidity();
        return;
    }

    // ── Validar contra el usuario guardado por register.js ─────
    // sessionStorage solo existe en esta pestaña: si la cerraste
    // y la volviste a abrir, esto estará vacío y pedirá registrarse
    // de nuevo.
    const usuario = JSON.parse(sessionStorage.getItem("usuarioRegistrado") || "null");

    if (!usuario) {
        email.setCustomValidity("No hay ninguna cuenta registrada en esta sesión. Regístrate primero.");
        email.reportValidity();
        return;
    }

    if (email.value !== usuario.email || password.value !== usuario.password) {
        password.setCustomValidity("Correo o contraseña incorrectos.");
        password.reportValidity();
        return;
    }

    // Todo correcto: redirigir
    window.location.href = "restaurants.html";
});
