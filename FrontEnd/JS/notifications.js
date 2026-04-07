document.addEventListener('DOMContentLoaded', async () => {
    const sessionUser = JSON.parse(sessionStorage.getItem('user'));

    if (!sessionUser || !sessionUser.id) {
        window.location.replace('/login');
        return;
    }

    const typeFilter = document.getElementById('type-filter');
    const orderFilter = document.getElementById('order-filter');
    const list = document.getElementById('notifications-list');

    let allNotifications = [];
    let typesMap = {};

    const formatTimeAgo = (isoString) => {
        if (!isoString) return 'Sin fecha';
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return 'Sin fecha';
        return date.toLocaleDateString('es-MX');
    };

    const escapeHtml = (str) => {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    };

    const populateTypeFilter = () => {
        typeFilter.innerHTML = '<option value="all">TIPO</option>';

        const typeIds = [...new Set(allNotifications.map(n => n.type_id).filter(v => v !== null && v !== undefined))];
        typeIds.forEach(typeId => {
            const option = document.createElement('option');
            option.value = String(typeId);
            option.textContent = (typesMap[typeId] || `TIPO ${typeId}`).toUpperCase();
            typeFilter.appendChild(option);
        });
    };

    const render = () => {
        if (allNotifications.length === 0) {
            list.innerHTML = '<p class="empty-text">No tiene notificaciones nueva</p>';
            return;
        }

        list.innerHTML = allNotifications.map(n => {
            const typeName = escapeHtml(typesMap[n.type_id] || `Tipo ${n.type_id || '-'}`);
            const description = escapeHtml(n.description || 'Sin descripción');
            const timeAgo = escapeHtml(formatTimeAgo(n.created_at));

            return `
                <article class="notification-item" data-id="${n.id}">
                    <div class="notification-left">
                        <div class="noti-icon">!</div>
                        <div class="notification-content">
                            <h3>${typeName.toUpperCase()}</h3>
                            <p>${description}</p>
                        </div>
                    </div>
                    <div class="notification-right">
                        <span class="notification-time">${timeAgo}</span>
                        <button type="button" class="delete-btn" data-id="${n.id}" aria-label="Borrar notificación">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                </article>
            `;
        }).join('');
    };

    const fetchAndRender = async () => {
        const params = new URLSearchParams({
            usr_id: String(sessionUser.id),
            order: orderFilter.value || 'desc'
        });

        if (typeFilter.value !== 'all') {
            params.set('type_id', typeFilter.value);
        }

        const response = await fetch(`/api/notifications?${params.toString()}`);
        const result = await response.json();

        if (!result.success) {
            list.innerHTML = '<p class="empty-text">No se pudieron cargar las notificaciones</p>';
            return;
        }

        allNotifications = result.notifications || [];
        typesMap = Object.fromEntries((result.types || []).map(t => [t.id, t.name]));
        populateTypeFilter();
        typeFilter.value = params.get('type_id') || 'all';
        render();
    };

    try {
        await fetchAndRender();
    } catch {
        list.innerHTML = '<p class="empty-text">No se pudieron cargar las notificaciones</p>';
        return;
    }

    typeFilter.addEventListener('change', fetchAndRender);
    orderFilter.addEventListener('change', fetchAndRender);

    list.addEventListener('click', async (event) => {
        const btn = event.target.closest('.delete-btn');
        if (!btn) return;

        const notificationId = btn.getAttribute('data-id');

        const confirmation = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar notificación?',
            text: 'Esta acción no se puede deshacer.',
            showCancelButton: true,
            confirmButtonText: 'Sí, borrar',
            cancelButtonText: 'Cancelar'
        });

        if (!confirmation.isConfirmed) return;

        try {
            const response = await fetch(`/api/notifications/${encodeURIComponent(notificationId)}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usr_id: sessionUser.id })
            });

            const result = await response.json();

            if (!result.success) {
                Swal.fire({ icon: 'error', title: 'Error', text: result.message || 'No se pudo borrar' });
                return;
            }

            allNotifications = allNotifications.filter(n => String(n.id) !== String(notificationId));
            if (allNotifications.length === 0) {
                await fetchAndRender();
            } else {
                render();
            }

            Swal.fire({
                icon: 'success',
                title: 'Eliminada',
                timer: 1200,
                showConfirmButton: false
            });
        } catch {
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo borrar' });
        }
    });
});
