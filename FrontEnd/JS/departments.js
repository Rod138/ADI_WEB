/**
 * TESINA: Logica cliente de administracion de departamentos y usuarios.
 * Responsabilidad: sincronizar selects, formularios y acciones CRUD visibles.
 * Regla de interfaz: habilitar controles segun permisos de sesion.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const depSelect        = document.getElementById('dep-select');
    const userFilterGroup  = document.getElementById('user-filter-group');
    const userSelect       = document.getElementById('user-select');
    const cardsRow         = document.getElementById('cards-row');

    // Dept card elements
    const depName          = document.getElementById('dep-name');
    const depStatus        = document.getElementById('dep-status');
    const depEditSec       = document.getElementById('dep-edit-section');
    const depInUseChk      = document.getElementById('dep-in-use-chk');
    const depConfirmChk    = document.getElementById('dep-confirm-chk');
    const depWarning       = document.getElementById('dep-warning');
    const depSaveBtn       = document.getElementById('dep-save-btn');

    // User card elements
    const userView         = document.getElementById('user-view');
    const userEditSec      = document.getElementById('user-edit-section');
    const userSaveBtn      = document.getElementById('user-save-btn');
    const userDeleteBtn    = document.getElementById('user-delete-btn');
    const userConfirmChk   = document.getElementById('user-confirm-chk');
    const createUserBtn    = document.getElementById('create-user-btn');

    const session = JSON.parse(sessionStorage.getItem('user'));

    // ── Load departments into first select ───────────────────
    let departmentsCache = [];
    try {
        const res  = await fetch('/api/departments');
        const data = await res.json();
        if (data.success) {
            departmentsCache = data.departments;
            data.departments.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.textContent = d.name;
                depSelect.appendChild(opt);
            });
        }
    } catch {
        Swal.fire({
            title: 'Error al cargar',
            text: 'No se pudo cargar la lista de departamentos',
            icon: 'error',
            confirmButtonColor: '#d33',
            confirmButtonText: 'Aceptar'
        });
    }

    // ── On department select change ──────────────────────────
    depSelect.addEventListener('change', async () => {
        const depId = depSelect.value;

        // Reset user second select
        userSelect.innerHTML = '<option value="">— Selecciona un usuario —</option>';
        userSelect.disabled = true;
        cardsRow.style.display = 'none';
        userEditSec.style.display = 'none';
        userDeleteBtn.style.display = 'none';
        userView.innerHTML = '';
        createUserBtn.style.display = 'none';

        if (!depId) return;

        // Refresh dept card from backend so status is always current
        await loadDeptCard(depId);

        // Show create-user button for admins
        if (session && Number(session.rol_id) >= 3) {
            createUserBtn.style.display = 'inline-flex';
            createUserBtn.onclick = () => showCreateUserForm(depId);
        }

        // Load users for this dept
        try {
            const res  = await fetch(`/api/users?dep_id=${encodeURIComponent(depId)}`);
            const data = await res.json();
            if (data.success) {
                data.users.forEach(u => {
                    const opt = document.createElement('option');
                    opt.value = u.id;
                    const fullName = u.name || '-';
                    opt.textContent = fullName || (u.name ?? '-');
                    userSelect.appendChild(opt);
                });
                if (data.users.length > 0) userSelect.disabled = false;
            }
        } catch {
            Swal.fire({
                title: 'Error',
                text: 'No se pudieron cargar los usuarios.',
                icon: 'error',
                confirmButtonColor: '#d33',
                confirmButtonText: 'Aceptar'
            });
        }
    });

    // ── On user select change ────────────────────────────────
    userSelect.addEventListener('change', async () => {
        const userId = userSelect.value;
        userView.innerHTML = '';
        userEditSec.style.display = 'none';
        if (!userId) return;
        await loadUserCard(userId);
    });

    // ── Load dept card ───────────────────────────────────────

    // Refleja en la UI el estado operativo del departamento seleccionado.
    function renderDeptCard(dep) {
        depName.textContent   = dep.name;
        depStatus.textContent = dep.is_in_use ? 'En uso' : 'Desocupado';
        depStatus.className   = 'info-value ' + (dep.is_in_use ? 'status-active' : 'status-inactive');

        if (session && Number(session.rol_id) >= 3) {
            depEditSec.style.display = 'block';
            depInUseChk.checked      = dep.is_in_use;
            depConfirmChk.checked    = false;
            depWarning.style.display = 'none';

            depInUseChk.onchange = () => {
                depWarning.style.display = !depInUseChk.checked ? 'block' : 'none';
            };

            depSaveBtn.onclick = async () => {
                if (!depConfirmChk.checked) {
                    Swal.fire({
                        title: 'Confirmación requerida',
                        text: 'Marca el checkbox de confirmación antes de guardar.',
                        icon: 'warning',
                        confirmButtonColor: '#ED7A13',
                        confirmButtonText: 'Aceptar'
                    });
                    return;
                }
                const activating = depInUseChk.checked && !dep.is_in_use;
                const r = await fetch(`/api/departments/${encodeURIComponent(dep.id)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_in_use: depInUseChk.checked })
                });
                const result = await r.json();
                if (result.success) {
                    await Swal.fire({
                        title: 'Actualizado',
                        text: 'Departamento actualizado correctamente.',
                        icon: 'success',
                        timer: 1600,
                        timerProgressBar: true,
                        showConfirmButton: false,
                        confirmButtonColor: '#6A8042'
                    });
                    // Full refresh in both cases
                    depSelect.dispatchEvent(new Event('change'));
                    if (activating) {
                        // Open the create form automatically after activating
                        await showCreateUserForm(dep.id);
                    }
                } else {
                    Swal.fire({
                        title: 'Error',
                        text: result.message,
                        icon: 'error',
                        confirmButtonColor: '#d33',
                        confirmButtonText: 'Aceptar'
                    });
                }
            };
        } else {
            depEditSec.style.display = 'none';
        }
    }

    // Consulta datos actualizados de departamento antes de pintar la tarjeta.
    async function loadDeptCard(depId) {
        try {
            const res  = await fetch('/api/departments');
            const data = await res.json();
            if (!data.success) return;
            departmentsCache = data.departments;
            const dep = data.departments.find(d => String(d.id) === String(depId));
            if (!dep) return;
            cardsRow.style.display = 'flex';
            renderDeptCard(dep);
        } catch { /* silent */ }
    }

    // ── Create user form (shown after activating dept) ──────
    // Presenta formulario de alta y envía usuario asociado al departamento activo.
    async function showCreateUserForm(depId) {
        cardsRow.style.display = 'flex';
        userEditSec.style.display = 'none';
        userView.innerHTML = `
            <div class="create-user-note">Nuevo usuario para este departamento</div>
            <div class="edit-grid">
                <div class="edit-field">
                    <label>Nombre *</label>
                    <input type="text" id="new-name" placeholder="Ej. Juan" minlength="3" maxlength="30" pattern="^[a-záéíóúñA-ZÁÉÍÓÚÑ\s]*$">
                </div>
                <div class="edit-field">
                    <label>Email *</label>
                    <input type="email" id="new-email" minlength="6" maxlength="320">
                </div>
                <div class="edit-field">
                    <label>Apellido paterno</label>
                    <input type="text" id="new-ap" placeholder="Ej. Pérez" minlength="1" maxlength="30" pattern="^[a-záéíóúñA-ZÁÉÍÓÚÑ\s]*$">
                </div>
                <div class="edit-field">
                    <label>Teléfono *</label>
                    <input type="tel" id="new-phone" placeholder="Ej. 5551234567" minlength="10" maxlength="10" pattern="^\d{10}$">
                </div>
                <div class="edit-field">
                    <label>Contraseña *</label>
                    <input type="password" id="new-password" minlength="8" maxlength="16">
                </div>
            </div>
            <button class="save-btn" id="new-user-submit-btn">Crear residente</button>
        `;

        document.getElementById('new-user-submit-btn').onclick = async () => {
            const nameInput = document.getElementById('new-name');
            const apInput = document.getElementById('new-ap');
            const emailInput = document.getElementById('new-email');
            const phoneInput = document.getElementById('new-phone');
            const passwordInput = document.getElementById('new-password');

            const body = {
                name:     nameInput.value.trim(),
                email:    emailInput.value.trim(),
                ap:       apInput ? String(apInput.value || '').trim().split(/\s+/)[0] : undefined,
                phone:    phoneInput.value.trim(),
                password: passwordInput.value,
                rol_id:   1,
                dep_id:   depId
            };

            // Validación frontend
            const nameRegex = /^[a-záéíóúñA-ZÁÉÍÓÚÑ\s]{3,30}$/;
            if (!nameRegex.test(body.name)) {
                Swal.fire({
                    title: 'Nombre inválido',
                    text: 'Nombre: 3-30 caracteres, solo letras y espacios',
                    icon: 'warning',
                    confirmButtonColor: '#ED7A13',
                    confirmButtonText: 'Aceptar'
                });
                return;
            }

            if (body.ap) {
                const apPaternal = String(body.ap || '').trim().split(/\s+/)[0];
                const apRegex = /^[a-záéíóúñA-ZÁÉÍÓÚÑ]{1,30}$/;
                if (!apRegex.test(apPaternal)) {
                    Swal.fire({
                        title: 'Apellido paterno inválido',
                        text: 'Solo letras, sin espacios, máximo 30 caracteres',
                        icon: 'warning',
                        confirmButtonColor: '#ED7A13',
                        confirmButtonText: 'Aceptar'
                    });
                    return;
                }
                body.ap = apPaternal;
            }

            const emailRegex = /^[^\s@]{1,64}@[^\s@]{1,255}\.[a-z]{2,}$/i;
            if (body.email.length < 6 || body.email.length > 320 || !emailRegex.test(body.email)) {
                Swal.fire({
                    title: 'Email inválido',
                    text: 'Email: 6-320 caracteres, formato válido requerido',
                    icon: 'warning',
                    confirmButtonColor: '#ED7A13',
                    confirmButtonText: 'Aceptar'
                });
                return;
            }

            const phoneRegex = /^\d{10}$/;
            if (!phoneRegex.test(body.phone)) {
                Swal.fire({
                    title: 'Teléfono inválido',
                    text: 'Teléfono: debe ser exactamente 10 dígitos',
                    icon: 'warning',
                    confirmButtonColor: '#ED7A13',
                    confirmButtonText: 'Aceptar'
                });
                return;
            }

            const passwordRegex = /^(?=.*[a-zA-Z\d])[a-zA-Z\d@$!%*?&]{8,16}$/;
            if (!passwordRegex.test(body.password)) {
                Swal.fire({
                    title: 'Contraseña inválida',
                    text: 'Contraseña: 8-16 caracteres con al menos 1 número o letra',
                    icon: 'warning',
                    confirmButtonColor: '#ED7A13',
                    confirmButtonText: 'Aceptar'
                });
                return;
            }

            const r = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await r.json();
            if (result.success) {
                await Swal.fire({
                    title: 'Usuario creado',
                    text: 'El nuevo usuario se creó correctamente.',
                    icon: 'success',
                    timer: 1800,
                    timerProgressBar: true,
                    showConfirmButton: false,
                    confirmButtonColor: '#6A8042'
                });
                depSelect.dispatchEvent(new Event('change'));
                await loadDeptCard(depId);
            } else {
                Swal.fire({
                    title: 'Error',
                    text: result.message,
                    icon: 'error',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Aceptar'
                });
            }
        };
    }

    // ── Load user card ───────────────────────────────────────
    // Recupera detalle de un usuario para vista detallada en tarjeta lateral.
    async function loadUserCard(userId) {
        try {
            const res  = await fetch(`/api/users/${encodeURIComponent(userId)}`);
            const data = await res.json();
            if (!data.success) {
                Swal.fire({
                    title: 'Error',
                    text: data.message,
                    icon: 'error',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Aceptar'
                });
                return;
            }
            renderUserCard(data.user, data.roles);
        } catch {
            Swal.fire({
                title: 'Error',
                text: 'Fallo de red.',
                icon: 'error',
                confirmButtonColor: '#d33',
                confirmButtonText: 'Aceptar'
            });
        }
    }

    // Construye vista de usuario y habilita acciones segun rol del sesionante.
    function renderUserCard(user, roles) {
        const canDelete = session && Number(session.rol_id) >= 3;

        const fields = [
            ['Nombre',     user.name],
            ['Email',      user.email],
            ['Teléfono',   user.phone],
        ];

        userView.innerHTML = fields.map(([label, val]) => `
            <div class="info-row">
                <span class="info-label">${escapeHtml(label)}</span>
                <span class="info-value">${escapeHtml(val ?? '—')}</span>
            </div>
        `).join('');

        if (!canDelete) {
            userEditSec.style.display = 'none';
            return;
        }

        userEditSec.style.display = 'block';
        userSaveBtn.style.display = 'none';
        userDeleteBtn.style.display = 'inline-flex';

        const editGrid = userEditSec.querySelector('.edit-grid');
        const subtitle = userEditSec.querySelector('.section-subtitle');
        const confirmLabel = userConfirmChk.closest('label');
        if (editGrid) editGrid.style.display = 'none';
        if (subtitle) subtitle.textContent = 'Administrar usuario';
        if (confirmLabel) confirmLabel.style.display = 'none';

        userDeleteBtn.onclick = async () => {
            if (!canDelete) return;

            const confirm = await Swal.fire({
                icon: 'warning',
                title: 'Eliminar residente',
                text: 'El residente se desasignará del departamento. Esta acción no elimina el registro.',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });

            if (!confirm.isConfirmed) return;

            const r = await fetch(`/api/users/${encodeURIComponent(user.id)}`, {
                method: 'DELETE'
            });
            const result = await r.json();

            if (result.success) {
                await Swal.fire({
                    title: 'Usuario eliminado',
                    text: 'El usuario se eliminó correctamente.',
                    icon: 'success',
                    timer: 1600,
                    timerProgressBar: true,
                    showConfirmButton: false,
                    confirmButtonColor: '#6A8042'
                });
                userSelect.value = '';
                depSelect.dispatchEvent(new Event('change'));
            } else {
                Swal.fire({
                    title: 'Error',
                    text: result.message ?? 'No se pudo eliminar el usuario.',
                    icon: 'error',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Aceptar'
                });
            }
        };
    }

    // Sanea texto dinamico antes de inyectarlo en HTML.
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});

