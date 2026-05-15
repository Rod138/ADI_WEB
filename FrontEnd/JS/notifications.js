/**
 * TESINA: Vista cliente para bandeja de notificaciones.
 * Responsabilidad: cargar notificaciones, filtrar por tipo y ordenar por fecha.
 * UX: formatea fechas y sanea texto para render seguro en HTML.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const sessionUser = JSON.parse(sessionStorage.getItem('user'));

    if (!sessionUser || !sessionUser.id) {
        window.location.replace('/login');
        return;
    }

    const typeFilter = document.getElementById('type-filter');
    const orderFilter = document.getElementById('order-filter');
    const list = document.getElementById('notifications-list');
    const paginationBox = document.getElementById('pagination-box');
    const prevBtn = document.getElementById('noti-prev-btn');
    const nextBtn = document.getElementById('noti-next-btn');
    const pageIndicator = document.getElementById('noti-page-indicator');

    let allNotifications = [];
    let filteredNotifications = [];
    let typesMap = {};
    const PAGE_SIZE = 10;
    let currentPage = 1;

    // Convierte marca temporal en etiqueta legible para la bandeja.
    const formatTimeAgo = (isoString) => {
        if (!isoString) return 'Sin fecha';
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return 'Sin fecha';
        return date.toLocaleDateString('es-MX');
    };

    // Escapa contenido de notificaciones antes de renderizarlo.
    const escapeHtml = (str) => {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    };

    // Reconstruye el selector de tipos segun el conjunto de resultados actual.
    const populateTypeFilter = () => {
        typeFilter.innerHTML = '<option value="all">TIPO</option>';

        const typeIds = [...new Set(allNotifications.map(n => n.type_id).filter(v => v !== null && v !== undefined))].sort((a, b) => Number(a) - Number(b));
        typeIds.forEach(typeId => {
            const option = document.createElement('option');
            option.value = String(typeId);
            option.textContent = (typesMap[typeId] || `TIPO ${typeId}`).toUpperCase();
            typeFilter.appendChild(option);
        });
    };

    // Pinta lista de tarjetas de notificacion en el estado de filtros activo.
    const render = (notifications) => {
        if (!notifications.length) {
            list.innerHTML = '<p class="empty-text">No tiene notificaciones nueva</p>';
            paginationBox.style.display = 'none';
            return;
        }

        const totalPages = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = notifications.slice(start, start + PAGE_SIZE);

        paginationBox.style.display = totalPages > 1 ? 'flex' : 'none';
        pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;

        list.innerHTML = pageItems.map(n => {
            const typeName = escapeHtml(typesMap[n.type_id] || `Tipo ${n.type_id || '-'}`);
            const description = escapeHtml(n.description || 'Sin descripción');
            const timeAgo = escapeHtml(formatTimeAgo(n.created_at));
            const unreadClass = n.read ? '' : ' unread';

            return `
                <article class="notification-item${unreadClass}" data-id="${n.id}" data-read="${n.read}">
                    <div class="notification-left">
                        <div class="noti-icon">${n.read ? '✓' : '•'}</div>
                        <div class="notification-content">
                            <h3>${typeName}</h3>
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

    // Consulta backend con filtros activos y refresca la vista de notificaciones.
    const fetchAndRender = async () => {
        return await withLock('notifications-fetchAndRender', async () => {
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
            currentPage = 1;
            applyFilters();
        });
    };

    const applyFilters = () => {
        populateTypeFilter();

        let filtered = [...allNotifications];
        if (typeFilter.value !== 'all') {
            filtered = filtered.filter(n => String(n.type_id) === String(typeFilter.value));
        }

        if (orderFilter.value === 'asc') {
            filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        } else {
            filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        filteredNotifications = filtered;
        currentPage = 1;
        render(filteredNotifications);
    };

    try {
        await fetchAndRender();
    } catch {
        list.innerHTML = '<p class="empty-text">No se pudieron cargar las notificaciones</p>';
        return;
    }

    typeFilter.addEventListener('change', applyFilters);
    orderFilter.addEventListener('change', applyFilters);

    prevBtn.addEventListener('click', () => {
        if (currentPage <= 1) return;
        currentPage -= 1;
        render(filteredNotifications);
    });

    nextBtn.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / PAGE_SIZE));
        if (currentPage >= totalPages) return;
        currentPage += 1;
        render(filteredNotifications);
    });

    const deleteAllBtn = document.getElementById('delete-all-btn');
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', async () => await withButtonLock(deleteAllBtn, async () => {
            if (filteredNotifications.length === 0) {
                Swal.fire({
                    title: 'Sin notificaciones',
                    text: 'No hay notificaciones para borrar.',
                    icon: 'info',
                    confirmButtonColor: '#6A8042',
                    confirmButtonText: 'Aceptar'
                });
                return;
            }

            const confirmation = await Swal.fire({
                icon: 'warning',
                title: '¿Borrar todas las notificaciones?',
                text: `Se eliminarán ${filteredNotifications.length} notificación(es). Esta acción no se puede deshacer.`,
                showCancelButton: true,
                confirmButtonText: 'Sí, borrar todas',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#d33'
            });

            if (!confirmation.isConfirmed) return;

            const response = await fetch('/api/notifications/delete-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usr_id: sessionUser.id })
            });

            const result = await response.json();

            if (!result.success) {
                Swal.fire({
                    title: 'Error al borrar',
                    text: result.message || 'No se pudieron borrar las notificaciones.',
                    icon: 'error',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Aceptar'
                });
                return;
            }

            allNotifications = [];
            filteredNotifications = [];
            currentPage = 1;
            render(filteredNotifications);

            Swal.fire({
                title: '¡Listo!',
                text: result.message || 'Todas las notificaciones fueron eliminadas.',
                icon: 'success',
                timer: 1500,
                timerProgressBar: true,
                showConfirmButton: false,
                confirmButtonColor: '#6A8042'
            });
        }, { loadingText: 'ELIMINANDO...' }));
    }

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
        await withButtonLock(btn, async () => {
            const response = await fetch(`/api/notifications/${encodeURIComponent(notificationId)}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usr_id: sessionUser.id })
            });

            const result = await response.json();

            if (!result.success) {
                Swal.fire({
                    title: 'Error al borrar',
                    text: result.message || 'No se pudo borrar.',
                    icon: 'error',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Aceptar'
                });
                return;
            }

            allNotifications = allNotifications.filter(n => String(n.id) !== String(notificationId));
            filteredNotifications = filteredNotifications.filter(n => String(n.id) !== String(notificationId));

            if (filteredNotifications.length === 0) {
                currentPage = 1;
            } else if (currentPage > Math.ceil(filteredNotifications.length / PAGE_SIZE)) {
                currentPage = Math.ceil(filteredNotifications.length / PAGE_SIZE);
            }

            render(filteredNotifications);

            Swal.fire({
                title: 'Notificación eliminada',
                text: 'La notificación se eliminó correctamente.',
                icon: 'success',
                timer: 1200,
                timerProgressBar: true,
                showConfirmButton: false,
                confirmButtonColor: '#6A8042'
            });
        }, { loadingText: 'ELIMINANDO...' });
    });

    // Mark notification as read when clicking the item (but not the delete button)
    list.addEventListener('click', async (event) => {
        const item = event.target.closest('.notification-item');
        if (!item) return;

        // If clicked delete button, ignore here (handled above)
        if (event.target.closest('.delete-btn')) return;

        const notificationId = item.getAttribute('data-id');
        const alreadyRead = item.getAttribute('data-read') === 'true';
        // Show detail modal
        const notif = allNotifications.find(n => String(n.id) === String(notificationId));
        const title = notif?.title || (typesMap[notif?.type_id] || 'Notificación');
        const description = notif?.description || '';

        await Swal.fire({
            title: escapeHtml(title),
            html: `<p style="text-align:left">${escapeHtml(description)}</p>`,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#6A8042'
        });

        if (alreadyRead) return;

        try {
            const response = await fetch(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usr_id: sessionUser.id })
            });

            const result = await response.json();
            if (!result.success) return;

            // Update local state and UI
            allNotifications = allNotifications.map(n => (String(n.id) === String(notificationId) ? { ...n, read: true } : n));
            filteredNotifications = filteredNotifications.map(n => (String(n.id) === String(notificationId) ? { ...n, read: true } : n));

            // Re-render current page
            render(filteredNotifications);

            // Update global indicator if available
            if (typeof window.updateGlobalUnreadIndicator === 'function') {
                const unread = (allNotifications || []).filter(n => !n.read).length;
                try { window.updateGlobalUnreadIndicator(unread); } catch (e) {}
            }
        } catch (e) {
            // ignore network errors silently
        }
    });
});
