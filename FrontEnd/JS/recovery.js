document.addEventListener("DOMContentLoaded", () => {
    const email = document.getElementById("email");
    const forgotPasswordForm = document.getElementById("forgot-password-form");

    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener("submit", async (e) => {
            e.preventDefault();

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

            try {
                const response = await fetch('/api/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email.value })
                });

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
                    text: 'No se pudo conectar con el servidor',
                    icon: 'error',
                    timer: 5000,
                    timerProgressBar: true,
                    draggable: true,
                    theme: 'auto'
                });
            }
        });
    }
});
