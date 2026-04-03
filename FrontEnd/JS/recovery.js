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

                const data = await response.json();
                if (data.success) {
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
        });
    }
});
