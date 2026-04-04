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

    const setEditable = (editable) => {
        nameInput.disabled = !editable;
        emailInput.disabled = !editable;
        phoneInput.disabled = !editable;
        passwordInput.disabled = !editable;
        passwordConfirmInput.disabled = !editable;
        editSaveBtn.textContent = editable ? 'GUARDAR' : 'EDITAR';
    };

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

        if (password || passwordConfirm) {
            if (!password || !passwordConfirm) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Contraseña incompleta',
                    text: 'Completa ambos campos de contraseña.'
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
