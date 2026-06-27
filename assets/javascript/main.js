const form = document.getElementById("loginForm");
const email = document.getElementById("email");
const password = document.getElementById("password");

// limpiar errores cuando el usuario vuelve a escribir
email.addEventListener("input", function(){
    email.setCustomValidity("");

});

password.addEventListener("input", function(){
    password.setCustomValidity("");
});

form.addEventListener("submit", function(e){
    e.preventDefault();

    // limpiar antes de validar
    email.setCustomValidity("");
    password.setCustomValidity("");

    // validar gmail
    if(!email.value.includes("@gmail.com")){
        email.setCustomValidity(
            "Ingrese un correo válido con @gmail.com"
        );
        email.reportValidity();
        return;
    }

    // validar contraseña
    if(password.value.length < 5){
        password.setCustomValidity(
            "La contraseña debe tener mínimo 5 caracteres"
        );
        password.reportValidity();
        return;
    }

    window.location.href="products.html";

});