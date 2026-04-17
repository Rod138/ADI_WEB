/**
 * TESINA: Logica de autenticacion en la vista de login.
 * Responsabilidad: validar campos, enviar credenciales y guardar sesion local.
 * Seguridad: limpia sesion previa antes de iniciar un nuevo acceso.
 */

// Estilos consistentes de alerta para toda la aplicación
const AlertConfig = {
    error: { icon: 'error', confirmButtonColor: '#d33' },
    success: { icon: 'success', confirmButtonColor: '#6A8042' },
    warning: { icon: 'warning', confirmButtonColor: '#ED7A13' },
    info: { icon: 'info', confirmButtonColor: '#0099ff' }
};

document.addEventListener("DOMContentLoaded", () => {
    // Al llegar al login se destruye cualquier sesión activa
    sessionStorage.removeItem('user');

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
                    title: 'Límite de caracteres',
                    text: "Máximo 320 carácteres en el correo",
                    ...AlertConfig.warning,
                    timer: 3000,
                    timerProgressBar: true,
                    showConfirmButton: false
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
                    title: 'Límite de caracteres',
                    text: "Máximo 32 carácteres en la contraseña",
                    ...AlertConfig.warning,
                    timer: 3000,
                    timerProgressBar: true,
                    showConfirmButton: false
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
                    title: "Campo vacío",
                    text: "Ingresa tu correo electrónico",
                    ...AlertConfig.error,
                    confirmButtonText: 'Aceptar'
                });
                data_is_fine = false;
            } else if (!email_regex.test(email.value)) {
                Swal.fire({
                    title: "Correo inválido",
                    text: "El correo no tiene un formato válido",
                    ...AlertConfig.error,
                    confirmButtonText: 'Aceptar'
                });
                data_is_fine = false;
            } else if (email.value.length > 320) {
                Swal.fire({
                    title: "Correo muy largo",
                    text: "Máximo 320 carácteres",
                    ...AlertConfig.error,
                    confirmButtonText: 'Aceptar'
                });
                data_is_fine = false;
            }

            // Contraseña
            if (!password.value || password.value === "") {
                Swal.fire({
                    title: "Campo vacío",
                    text: "Ingresa tu contraseña",
                    ...AlertConfig.error,
                    confirmButtonText: 'Aceptar'
                });
                data_is_fine = false;
            } else if (password.value.length > 32) {
                Swal.fire({
                    title: "Contraseña muy larga",
                    text: "Máximo 32 carácteres",
                    ...AlertConfig.error,
                    confirmButtonText: 'Aceptar'
                });
                data_is_fine = false;
            }

            if (data_is_fine) {
                await login(email.value, password.value);
            }
        });
    }
});

// Ejecuta autenticacion remota y persiste sesion local para navegacion protegida.
async function login(correo, contrasenna) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: correo, password: contrasenna })
        });
        const data = await response.json();

        if (data.success) {
            sessionStorage.setItem('user', JSON.stringify(data.user));
            await Swal.fire({
                title: `¡Bienvenido, ${data.user.name}!`,
                ...AlertConfig.success,
                timer: 2000,
                timerProgressBar: true,
                showConfirmButton: false
            });
            window.location.href = '/main';
        } else {
            Swal.fire({
                title: 'Error de autenticación',
                text: data.message || 'Correo o contraseña incorrectos',
                ...AlertConfig.error,
                confirmButtonText: 'Reintentar'
            });
        }
    } catch (error) {
        Swal.fire({
            title: 'Error de conexión',
            text: 'No se pudo conectar con el servidor',
            ...AlertConfig.error,
            confirmButtonText: 'Aceptar'
        });
    }
}
