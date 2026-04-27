/**
 * TESINA: Recuperacion de contrasena desde el cliente.
 * Responsabilidad: validar correo y solicitar envio de enlace de recuperacion.
 * UX: bloquea envio repetido mientras la solicitud esta en proceso.
 */

document.addEventListener("DOMContentLoaded", () => {
    const email = document.getElementById("email");
    const forgotPasswordForm = document.getElementById("forgot-password-form");
    const email_regex = /^[^\s@]{1,64}@[^\s@]{1,255}\.[a-z]{2,}$/i;

    if (forgotPasswordForm) {
        // Valida correo y dispara solicitud de recuperacion con timeout de seguridad.
        forgotPasswordForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitButton = forgotPasswordForm.querySelector('button[type="submit"]');

            if (!email || !email.value) {
                Swal.fire({
                    titleText: "Campo vacío",
                    text: "Debe llenar el campo del correo electrónico",
                    icon: "error",
                    timer: 5000,
                    timerProgressBar: true,
                    draggable: true,
                    theme: 'auto'
                });
                return;
            }

            const emailTrimmed = email.value.trim();
            if (emailTrimmed.length < 6 || emailTrimmed.length > 320) {
                Swal.fire({
                    titleText: "Correo inválido",
                    text: "El correo debe tener entre 6 y 320 caracteres",
                    icon: "error",
                    timer: 5000,
                    timerProgressBar: true,
                    draggable: true,
                    theme: 'auto'
                });
                return;
            }

            if (!email_regex.test(emailTrimmed)) {
                Swal.fire({
                    titleText: "Correo inválido",
                    text: "El correo no tiene un formato válido",
                    icon: "error",
                    timer: 5000,
                    timerProgressBar: true,
                    draggable: true,
                    theme: 'auto'
                });
                return;
            }

            try {
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = 'ENVIANDO...';
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 20000);

                const response = await fetch('/api/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailTrimmed }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const contentType = response.headers.get('content-type') || '';
                let data = null;

                if (contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    const raw = await response.text();
                    data = {
                        success: false,
                        message: raw && raw.length < 200 ? raw : `Error del servidor (${response.status})`
                    };
                }

                if (response.ok && data.success) {
                    await Swal.fire({
                        titleText: 'Solicitud enviada',
                        text: data.message,
                        icon: 'success',
                        timer: 3000,
                        timerProgressBar: true,
                        theme: 'auto'
                    });
                    window.location.href = '/login';
                } else {
                    Swal.fire({
                        titleText: `Error ${response.status}`,
                        text: data.message || 'No se pudo procesar la solicitud',
                        icon: 'error',
                        timer: 5000,
                        timerProgressBar: true,
                        draggable: true,
                        theme: 'auto'
                    });
                }
            } catch (error) {
                console.error('Error en recuperación de contraseña:', error);
                Swal.fire({
                    titleText: 'Error de conexión',
                    text: error.name === 'AbortError'
                        ? 'La solicitud tardó demasiado. Verifica el servidor e intenta de nuevo.'
                        : 'No se pudo conectar con el servidor',
                    icon: 'error',
                    timer: 5000,
                    timerProgressBar: true,
                    draggable: true,
                    theme: 'auto'
                });
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'ENVIAR CONTRASEÑA';
                }
            }
        });
    }
});
