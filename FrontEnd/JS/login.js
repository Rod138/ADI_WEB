document.addEventListener("DOMContentLoaded", () => {
    const email = document.getElementById("email");
    const password = document.getElementById("passw");
    const log_in_form = document.getElementById("login-form");

    const email_regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    // Correo
    if (email) {
        email.addEventListener("input", function () {
            if (this.value.length > 320) {
                this.value = this.value.slice(0, 320);
                Swal.fire({
                    text: "Debe ingresar máximo 320 carácteres",
                    icon: "error",
                    timer: 5000,
                    timerProgressBar: true,
                    draggable: true,
                    theme: 'auto'
                });
            }
        });
    }

    // Contraseña
    if (password) {
        password.addEventListener("input", function () {
            if (this.value.length > 32) {
                this.value = this.value.slice(0, 32);
                Swal.fire({
                    text: "Debe ingresar máximo 32 carácteres",
                    icon: "error",
                    timer: 5000,
                    timerProgressBar: true,
                    draggable: true,
                    theme: 'auto'
                });
            }
        });
    }

    // Form
    if (log_in_form) {
        log_in_form.addEventListener("submit", async function (e) {
            e.preventDefault();
            let data_is_fine = true;

            // Correo
            if (!email.value || email.value === "") {
                Swal.fire({
                    titleText: "Campo vacío",
                    text: "Debe llenar el campo del correo electrónico",
                    icon: "error",
                    timer: 5000,
                    timerProgressBar: true,
                    draggable: true,
                    theme: 'auto'
                });
                data_is_fine = false;
            } else if (!email_regex.test(email.value)) {
                Swal.fire({
                    titleText: "Correo inválido",
                    text: "Ingrese un correo electrónico válido",
                    icon: "error",
                    timer: 5000,
                    timerProgressBar: true,
                    draggable: true,
                    theme: 'auto'
                });
                data_is_fine = false;
            } else if (email.value.length > 320) {
                Swal.fire({
                    text: "Debe ingresar máximo 320 carácteres en el campo del correo electrónico",
                    icon: "error",
                    timer: 5000,
                    timerProgressBar: true,
                    draggable: true,
                    theme: 'auto'
                });
                data_is_fine = false;
            }

            // Contraseña
            if (!password.value || password.value === "") {
                Swal.fire({
                    titleText: "Campo vacío",
                    text: "Debe llenar el campo de la contraseña",
                    icon: "error",
                    timer: 5000,
                    timerProgressBar: true,
                    draggable: true,
                    theme: 'auto'
                });
                data_is_fine = false;
            } else if (password.value.length > 32) {
                Swal.fire({
                    text: "Debe ingresar máximo 32 carácteres en el campo de la contraseña",
                    icon: "error",
                    timer: 5000,
                    timerProgressBar: true,
                    draggable: true,
                    theme: 'auto'
                });
                data_is_fine = false;
            }

            if (data_is_fine) {
                await login(email.value, password.value);
            }
        });
    }
});

async function login(correo, contrasenna) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: correo, password: contrasenna })
        });
        const data = await response.json();

        if (data.success) {
            await Swal.fire({
                titleText: `Bienvenido, ${data.user.name}`,
                icon: 'success',
                timer: 2000,
                timerProgressBar: true,
                theme: 'auto'
            });
            window.location.href = '/main';
        } else {
            Swal.fire({
                titleText: 'Error',
                text: data.message,
                icon: 'error',
                timer: 5000,
                timerProgressBar: true,
                draggable: true,
                theme: 'auto'
            });
        }
    } catch (error) {
        Swal.fire({
            titleText: 'Error de conexión',
            text: 'No se pudo conectar con el servidor',
            icon: 'error',
            timer: 5000,
            timerProgressBar: true,
            draggable: true,
            theme: 'auto'
        });
    }
}
