/**
 * TESINA: Lógica de autenticación en la vista de login.
 * Responsabilidad: validar campos, enviar credenciales y guardar sesión local.
 * Seguridad: limpia sesión previa antes de iniciar un nuevo acceso.
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

    const email_regex = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/i;
    const password_regex = /^(?=.*[a-zA-Z\d])[a-zA-Z\d@$!%*?&]{8,16}$/;

    const urlParams = new URLSearchParams(window.location.search);
    const reasonFromUrl = urlParams.get('reason');
    const reasonFromStorage = localStorage.getItem('adi_login_notice');
    const reason = reasonFromUrl || reasonFromStorage;

    if (reason === 'session-ended') {
        Swal.fire({
            title: 'Tu sesión terminó',
            text: 'Por seguridad, debes volver a ingresar.',
            ...AlertConfig.info,
            confirmButtonText: 'Entendido'
        });
        localStorage.removeItem('adi_login_notice');
    }

    // Correo
    if (email) {
        email.addEventListener("input", function () {
            if (this.value.length > 320) {
                this.value = this.value.slice(0, 320);
                Swal.fire({
                    title: 'Límite de caracteres',
                    text: "Máximo 320 caracteres en el correo",
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
            if (this.value.length > 16) {
                this.value = this.value.slice(0, 16);
                Swal.fire({
                    title: 'Límite de caracteres',
                    text: "Máximo 16 caracteres en la contraseña",
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
            const submitButton = log_in_form.querySelector('button[type="submit"]');
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
                    text: "Máximo 320 caracteres",
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
            } else if (password.value.length < 8) {
                Swal.fire({
                    title: "Contraseña muy corta",
                    text: "Mínimo 8 caracteres requeridos",
                    ...AlertConfig.error,
                    confirmButtonText: 'Aceptar'
                });
                data_is_fine = false;
            } else if (password.value.length > 16) {
                Swal.fire({
                    title: "Contraseña muy larga",
                    text: "Máximo 16 caracteres",
                    ...AlertConfig.error,
                    confirmButtonText: 'Aceptar'
                });
                data_is_fine = false;
            } else if (!password_regex.test(password.value)) {
                // Validación más específica para el mensaje
                const hasAlphanumeric = /[a-zA-Z0-9]/.test(password.value);
                if (!hasAlphanumeric) {
                    Swal.fire({
                        title: "Contraseña inválida",
                        text: "Debe contener al menos 1 número o letra",
                        ...AlertConfig.error,
                        confirmButtonText: 'Aceptar'
                    });
                } else {
                    Swal.fire({
                        title: "Contraseña inválida",
                        text: "Caracteres permitidos: letras, números, @$!%*?&-",
                        ...AlertConfig.error,
                        confirmButtonText: 'Aceptar'
                    });
                }
                data_is_fine = false;
            }

            if (data_is_fine) {
                await withButtonLock(submitButton, async () => {
                    await login(email.value, password.value);
                }, { loadingText: 'ACCEDIENDO...' });
            }
        });
    }
});

// Ejecuta autenticación remota y persiste sesión local para navegación protegida.
async function login(correo, contrasenna) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: correo, password: contrasenna })
        });
        const data = await response.json();

        if (data.success) {
            sessionStorage.setItem('user', JSON.stringify({
                id: data.user.id,
                email: data.user.email,
                phone: data.user.phone,
                name: data.user.name,
                rol_id: data.user.rol_id,
                dep_id: data.user.dep_id,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                sessionExpiresAt: Date.now() + (3 * 24 * 60 * 60 * 1000)
            }));
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
