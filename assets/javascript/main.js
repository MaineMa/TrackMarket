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

    // Redirigir directo, sin verificar CSVs
    window.location.href = "restaurants.html";
});
