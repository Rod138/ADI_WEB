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
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar la lista de departamentos.' });
    }

    // ── On department select change ──────────────────────────
    depSelect.addEventListener('change', async () => {
        const depId = depSelect.value;

        // Reset user second select
        userSelect.innerHTML = '<option value="">— Selecciona un usuario —</option>';
        userSelect.disabled = true;
        cardsRow.style.display = 'none';
        userEditSec.style.display = 'none';
        userView.innerHTML = '';
        createUserBtn.style.display = 'none';

        if (!depId) return;

        // Show dept card from cache
        const dep = departmentsCache.find(d => String(d.id) === String(depId));
        if (dep) {
            cardsRow.style.display = 'flex';
            renderDeptCard(dep);
        }

        // Show create-user button for admins
        if (session && session.rol_id > 2) {
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
                    opt.textContent = `${u.name ?? '-'} ${u.ap ?? '-'}`;
                    userSelect.appendChild(opt);
                });
                if (data.users.length > 0) userSelect.disabled = false;
            }
        } catch {
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar los usuarios.' });
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

    function renderDeptCard(dep) {
        depName.textContent   = dep.name;
        depStatus.textContent = dep.is_in_use ? 'En uso' : 'Desocupado';
        depStatus.className   = 'info-value ' + (dep.is_in_use ? 'status-active' : 'status-inactive');

        if (session && session.rol_id > 2) {
            depEditSec.style.display = 'block';
            depInUseChk.checked      = dep.is_in_use;
            depConfirmChk.checked    = false;
            depWarning.style.display = 'none';

            depInUseChk.onchange = () => {
                depWarning.style.display = !depInUseChk.checked ? 'block' : 'none';
            };

            depSaveBtn.onclick = async () => {
                if (!depConfirmChk.checked) {
                    Swal.fire({ icon: 'warning', title: 'Confirmación requerida', text: 'Marca el checkbox de confirmación antes de guardar.' });
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
                    await Swal.fire({ icon: 'success', title: 'Actualizado', timer: 1600, timerProgressBar: true, showConfirmButton: false });
                    // Full refresh in both cases
                    depSelect.dispatchEvent(new Event('change'));
                    if (activating) {
                        // Open the create form automatically after activating
                        await showCreateUserForm(dep.id);
                    }
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: result.message });
                }
            };
        } else {
            depEditSec.style.display = 'none';
        }
    }

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
    async function showCreateUserForm(depId) {
        let roles = [];
        try {
            const r = await fetch('/api/roles');
            const d = await r.json();
            if (d.success) roles = d.roles;
        } catch { /* silent */ }

        const rolesOptions = roles.map(r =>
            `<option value="${r.id}">${escapeHtml(r.name ?? String(r.id))}</option>`
        ).join('');

        cardsRow.style.display = 'flex';
        userEditSec.style.display = 'none';
        userView.innerHTML = `
            <div class="create-user-note">Nuevo usuario para este departamento</div>
            <div class="edit-grid">
                <div class="edit-field">
                    <label>Nombre *</label>
                    <input type="text" id="new-name">
                </div>
                <div class="edit-field">
                    <label>Apellido paterno *</label>
                    <input type="text" id="new-ap">
                </div>
                <div class="edit-field">
                    <label>Apellido materno</label>
                    <input type="text" id="new-am" placeholder="(opcional)">
                </div>
                <div class="edit-field">
                    <label>Email *</label>
                    <input type="email" id="new-email">
                </div>
                <div class="edit-field">
                    <label>Teléfono *</label>
                    <input type="text" id="new-phone">
                </div>
                <div class="edit-field">
                    <label>Contraseña *</label>
                    <input type="password" id="new-password">
                </div>
                <div class="edit-field">
                    <label>Rol *</label>
                    <select id="new-rol">${rolesOptions}</select>
                </div>
            </div>
            <button class="save-btn" id="new-user-submit-btn">Crear usuario</button>
        `;

        document.getElementById('new-user-submit-btn').onclick = async () => {
            const body = {
                name:     document.getElementById('new-name').value.trim(),
                ap:       document.getElementById('new-ap').value.trim(),
                am:       document.getElementById('new-am').value.trim() || null,
                email:    document.getElementById('new-email').value.trim(),
                phone:    document.getElementById('new-phone').value.trim(),
                password: document.getElementById('new-password').value,
                rol_id:   parseInt(document.getElementById('new-rol').value, 10),
                dep_id:   depId
            };

            if (!body.name || !body.ap || !body.email || !body.phone || !body.password) {
                Swal.fire({ icon: 'warning', title: 'Campos requeridos', text: 'Completa todos los campos obligatorios.' });
                return;
            }

            const r = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await r.json();
            if (result.success) {
                await Swal.fire({ icon: 'success', title: 'Usuario creado', timer: 1800, timerProgressBar: true, showConfirmButton: false });
                depSelect.dispatchEvent(new Event('change'));
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: result.message });
            }
        };
    }

    // ── Load user card ───────────────────────────────────────
    async function loadUserCard(userId) {
        try {
            const res  = await fetch(`/api/users/${encodeURIComponent(userId)}`);
            const data = await res.json();
            if (!data.success) {
                Swal.fire({ icon: 'error', title: 'Error', text: data.message });
                return;
            }
            renderUserCard(data.user, data.roles);
        } catch {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Fallo de red.' });
        }
    }

    function renderUserCard(user, roles) {
        const canEdit = session && (session.rol_id > 2 || String(session.id) === String(user.id));

        const fields = [
            ['Nombre',           user.name],
            ['Apellido paterno', user.ap],
            ['Apellido materno', user.am ?? '—'],
            ['Email',            user.email],
            ['Teléfono',         user.phone],
        ];

        userView.innerHTML = fields.map(([label, val]) => `
            <div class="info-row">
                <span class="info-label">${escapeHtml(label)}</span>
                <span class="info-value">${escapeHtml(val ?? '—')}</span>
            </div>
        `).join('');

        if (!canEdit) { userEditSec.style.display = 'none'; return; }

        userEditSec.style.display = 'block';
        userConfirmChk.checked    = false;

        document.getElementById('edit-name').value     = user.name   ?? '';
        document.getElementById('edit-ap').value       = user.ap     ?? '';
        document.getElementById('edit-am').value       = user.am     ?? '';
        document.getElementById('edit-email').value    = user.email  ?? '';
        document.getElementById('edit-phone').value    = user.phone  ?? '';

        const rolSelect = document.getElementById('edit-rol');
        rolSelect.innerHTML = (roles ?? []).map(r =>
            `<option value="${r.id}" ${r.id === user.rol_id ? 'selected' : ''}>${escapeHtml(r.name ?? String(r.id))}</option>`
        ).join('');

        userSaveBtn.onclick = async () => {
            if (!userConfirmChk.checked) {
                Swal.fire({ icon: 'warning', title: 'Confirmación requerida', text: 'Marca el checkbox de confirmación antes de guardar.' });
                return;
            }

            const body = {
                name:   document.getElementById('edit-name').value.trim()  || null,
                ap:     document.getElementById('edit-ap').value.trim()    || null,
                am:     document.getElementById('edit-am').value.trim()    || null,
                email:  document.getElementById('edit-email').value.trim() || null,
                phone:  document.getElementById('edit-phone').value.trim() || null,
                rol_id: parseInt(document.getElementById('edit-rol').value, 10),
            };

            const r = await fetch(`/api/users/${encodeURIComponent(user.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await r.json();
            if (result.success) {
                // Update view immediately with new values
                const updatedUser = { ...user, ...body };
                const fields = [
                    ['Nombre',           updatedUser.name],
                    ['Apellido paterno', updatedUser.ap],
                    ['Apellido materno', updatedUser.am ?? '—'],
                    ['Email',            updatedUser.email],
                    ['Teléfono',         updatedUser.phone],
                ];
                userView.innerHTML = fields.map(([label, val]) => `
                    <div class="info-row">
                        <span class="info-label">${escapeHtml(label)}</span>
                        <span class="info-value">${escapeHtml(val ?? '—')}</span>
                    </div>
                `).join('');
                userConfirmChk.checked = false;
                await Swal.fire({ icon: 'success', title: 'Guardado', timer: 1600, timerProgressBar: true, showConfirmButton: false });
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: result.message });
            }
        };
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});

