document.addEventListener('DOMContentLoaded', async () => {
    const sessionUser = JSON.parse(sessionStorage.getItem('user'));

    if (!sessionUser || !sessionUser.id) {
        window.location.replace('/login');
        return;
    }

    const typeFilter = document.getElementById('type-filter');
    const areaFilter = document.getElementById('area-filter');
    const stateFilter = document.getElementById('state-filter');
    const list = document.getElementById('notifications-list');

    let allNotifications = [];
    let typesMap = {};

    const extractArea = (notification) => {
        if (notification.area_name) return String(notification.area_name).trim();

        const titleMatch = String(notification.title || '').match(/area\s*:?\s*([a-z0-9]+(?:\s+[a-z0-9]+){0,3})/i);
        if (titleMatch) return titleMatch[1].trim();

        const descriptionMatch = String(notification.description || '').match(/area\s*:?\s*([a-z0-9]+(?:\s+[a-z0-9]+){0,3})/i);
        if (descriptionMatch) return descriptionMatch[1].trim();

        return 'Sin área';
    };

    const formatTimeAgo = (isoString) => {
        if (!isoString) return 'Sin fecha';
        const now = Date.now();
        const date = new Date(isoString).getTime();
        if (isNaN(date)) return 'Sin fecha';
        const diff = Math.max(0, now - date);
        const minutes = Math.floor(diff / 60000);

        if (minutes < 1) return 'Hace un momento';
        if (minutes < 60) return `Hace ${minutes} min`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `Hace ${hours} h`;

        const days = Math.floor(hours / 24);
        return `Hace ${days} d`;
    };

    const escapeHtml = (str) => {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    };

    const populateFilters = () => {
        const typeIds = [...new Set(allNotifications.map(n => n.type_id).filter(v => v !== null && v !== undefined))];
        typeIds.forEach(typeId => {
            const option = document.createElement('option');
            option.value = String(typeId);
            option.textContent = (typesMap[typeId] || `TIPO ${typeId}`).toUpperCase();
            typeFilter.appendChild(option);
        });

        const areas = [...new Set(allNotifications.map(n => extractArea(n)))];
        areas.forEach(area => {
            const option = document.createElement('option');
            option.value = area;
            option.textContent = area.toUpperCase();
            areaFilter.appendChild(option);
        });
    };

    const render = () => {
        const selectedType = typeFilter.value;
        const selectedArea = areaFilter.value;
        const selectedState = stateFilter.value;

        let filtered = [...allNotifications];

        if (selectedType !== 'all') {
            filtered = filtered.filter(n => String(n.type_id) === selectedType);
        }

        if (selectedArea !== 'all') {
            filtered = filtered.filter(n => extractArea(n) === selectedArea);
        }

        if (selectedState === 'read') {
            filtered = filtered.filter(n => Boolean(n.read));
        } else if (selectedState === 'unread') {
            filtered = filtered.filter(n => !Boolean(n.read));
        }

        if (filtered.length === 0) {
            list.innerHTML = '<p class="empty-text">No tiene notificaciones nueva</p>';
            return;
        }

        list.innerHTML = filtered.map(n => {
            const typeName = escapeHtml(typesMap[n.type_id] || `Tipo ${n.type_id || '-'}`);
            const description = escapeHtml(n.description || 'Sin descripción');
            const area = escapeHtml(extractArea(n));
            const timeAgo = escapeHtml(formatTimeAgo(n.created_at));

            return `
                <article class="notification-item" data-id="${n.id}">
                    <div class="notification-left">
                        <div class="noti-icon">!</div>
                        <div class="notification-content">
                            <h3>${typeName.toUpperCase()}</h3>
                            <p>${description}</p>
                            <small>Área: ${area}</small>
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

    try {
        const response = await fetch(`/api/notifications?usr_id=${encodeURIComponent(sessionUser.id)}`);
        const result = await response.json();

        if (!result.success) {
            list.innerHTML = '<p class="empty-text">No se pudieron cargar las notificaciones</p>';
            return;
        }

        allNotifications = result.notifications || [];
        typesMap = Object.fromEntries((result.types || []).map(t => [t.id, t.name]));

        populateFilters();
        render();
    } catch {
        list.innerHTML = '<p class="empty-text">No se pudieron cargar las notificaciones</p>';
        return;
    }

    typeFilter.addEventListener('change', render);
    areaFilter.addEventListener('change', render);
    stateFilter.addEventListener('change', render);

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
            render();

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
