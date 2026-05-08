/**
 * TESINA: Gestion del perfil de usuario en cliente.
 * Responsabilidad: mostrar datos de sesion, habilitar edicion y guardar cambios.
 * Control: alterna modo lectura/edicion para evitar modificaciones accidentales.
 */

// Patrones de validación consistentes
const ValidationPatterns = {
    nameRegex: /^[a-záéíóúñA-ZÁÉÍÓÚÑ\s]{3,30}$/,
    // Local-part: allow RFC common characters, dots not consecutive or at ends
    emailRegex: /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/i,
    phoneRegex: /^\d{10}$/,
    passwordRegex: /^(?=.*[a-zA-Z\d])[a-zA-Z\d@$!%*?&]{8,16}$/
};

document.addEventListener('DOMContentLoaded', async () => {
    const sessionUser = JSON.parse(sessionStorage.getItem('user'));

    if (!sessionUser || !sessionUser.id) {
        window.location.replace('/login');
        return;
    }

    const nameInput = document.getElementById('profile-name');
    const depInput = document.getElementById('profile-department');
    const emailInput = document.getElementById('profile-email');
    const phoneInput = document.getElementById('profile-phone');
    const passwordInput = document.getElementById('profile-password');
    const passwordConfirmInput = document.getElementById('profile-password-confirm');
    const editSaveBtn = document.getElementById('edit-save-btn');

    let currentUserId = sessionUser.id;
    let isEditing = false;

    // Activa o bloquea campos para alternar entre modo consulta y modo edicion.
    const setEditable = (editable) => {
        nameInput.disabled = !editable;
        emailInput.disabled = !editable;
        phoneInput.disabled = !editable;
        passwordInput.disabled = !editable;
        passwordConfirmInput.disabled = !editable;
        editSaveBtn.textContent = editable ? 'GUARDAR' : 'EDITAR';
    };

    // Obtiene perfil completo del usuario logueado y precarga el formulario.
    const loadProfile = async () => {
        const response = await fetch(`/api/users/${encodeURIComponent(currentUserId)}`);
        const result = await response.json();

        if (!result.success) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: result.message || 'No se pudo cargar el perfil.'
            });
            return;
        }

        nameInput.value = result.user?.name || '';
        emailInput.value = result.user?.email || '';
        phoneInput.value = result.user?.phone || '';
        depInput.value = result.department?.name || 'Sin departamento';
    };

    try {
        await loadProfile();
    } catch {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el perfil.'
        });
    }

    setEditable(false);

    editSaveBtn.addEventListener('click', async () => {
        if (!isEditing) {
            isEditing = true;
            passwordInput.value = '';
            passwordConfirmInput.value = '';
            setEditable(true);
            return;
        }

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const phone = phoneInput.value.trim();
        const password = passwordInput.value;
        const passwordConfirm = passwordConfirmInput.value;

        if (!name || !email || !phone) {
            Swal.fire({
                icon: 'warning',
                title: 'Campos requeridos',
                text: 'Completa nombre, correo y teléfono.'
            });
            return;
        }

        // Validar nombre: 3-30 caracteres, solo letras y espacios
        if (!ValidationPatterns.nameRegex.test(name)) {
            Swal.fire({
                icon: 'warning',
                title: 'Nombre inválido',
                text: 'El nombre debe tener 3-30 caracteres y contener solo letras y espacios'
            });
            return;
        }

        // Validar email: 6-320 caracteres, formato válido
        if (email.length < 6 || email.length > 320 || !ValidationPatterns.emailRegex.test(email)) {
            Swal.fire({
                icon: 'warning',
                title: 'Email inválido',
                text: 'El email debe tener entre 6 y 320 caracteres y formato válido'
            });
            return;
        }

        // Validar teléfono: exactamente 10 dígitos
        if (!ValidationPatterns.phoneRegex.test(phone)) {
            Swal.fire({
                icon: 'warning',
                title: 'Teléfono inválido',
                text: 'El teléfono debe contener exactamente 10 dígitos'
            });
            return;
        }

        if (password || passwordConfirm) {
            if (!password || !passwordConfirm) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Contraseña incompleta',
                    text: 'Completa ambos campos de contraseña.'
                });
                return;
            }

            if (password.length < 8) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Contraseña muy corta',
                    text: 'La contraseña debe tener mínimo 8 caracteres'
                });
                return;
            }

            if (password.length > 16) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Contraseña muy larga',
                    text: 'La contraseña debe tener máximo 16 caracteres'
                });
                return;
            }

            const hasAlphanumeric = /[a-zA-Z0-9]/.test(password);
            if (!hasAlphanumeric) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Contraseña inválida',
                    text: 'Debe contener al menos 1 número o letra'
                });
                return;
            }

            const passwordCharRegex = /^[a-zA-Z0-9@$!%*?&-]+$/;
            if (!passwordCharRegex.test(password)) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Contraseña inválida',
                    text: 'Caracteres permitidos: letras, números, @$!%*?&-'
                });
                return;
            }

            if (password !== passwordConfirm) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Contraseñas diferentes',
                    text: 'La confirmación no coincide con la nueva contraseña.'
                });
                return;
            }
        }

        const body = { name, email, phone };
        if (password) {
            body.password = password;
        }

        try {
            const response = await fetch(`/api/users/${encodeURIComponent(currentUserId)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await response.json();

            if (!result.success) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: result.message || 'No se pudo actualizar el perfil.'
                });
                return;
            }

            const updatedSession = { ...sessionUser, name, email, phone };
            sessionStorage.setItem('user', JSON.stringify(updatedSession));

            isEditing = false;
            passwordInput.value = '';
            passwordConfirmInput.value = '';
            setEditable(false);

            Swal.fire({
                icon: 'success',
                title: 'Perfil actualizado',
                timer: 1400,
                showConfirmButton: false
            });
        } catch {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo actualizar el perfil.'
            });
        }
    });
});
