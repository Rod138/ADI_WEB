document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('nav-notifications-btn');
    const dropdown = document.getElementById('notifications-dropdown');
    const list = document.getElementById('nav-noti-list');
    const deleteAllBtn = document.getElementById('delete-all-btn-mini');

    const PAGE_LIMIT = 6;

    const escapeHtml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const formatTime = (iso) => {
        if (!iso) return '';
        try { return new Date(iso).toLocaleDateString('es-MX'); } catch { return '' }
    };

    const renderList = (items) => {
        if (!items || items.length === 0) {
            list.innerHTML = '<div class="nd-empty">Sin notificaciones</div>';
            updateBadge(0);
            return;
        }

        list.innerHTML = items.map(n => {
            const unreadCls = n.read ? '' : ' unread';
            const title = escapeHtml(n.title || (n.type_name || 'Notificación'));
            const desc = escapeHtml(n.description || '');
            const time = escapeHtml(formatTime(n.created_at));
            const unreadDot = n.read ? '' : '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#6A8042;margin-right:6px;flex-shrink:0;margin-top:2px;"></span>';
            return `
                <div class="nd-item${unreadCls}" data-id="${n.id}" data-read="${n.read}">
                    <div class="nd-left">
                        ${unreadDot}
                        <div style="flex:1">
                            <div class="nd-title">${title}</div>
                            <div class="nd-desc">${desc}</div>
                        </div>
                    </div>
                    <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
                        <div class="nd-time">${time}</div>
                        <button class="nav-icon-btn nd-delete" data-id="${n.id}" title="Borrar">×</button>
                    </div>
                </div>
            `;
        }).join('');

        const unreadCount = (items || []).filter(i => !i.read).length;
        updateBadge(unreadCount);
    };

    const updateBadge = (count) => {
        let badge = btn.querySelector('.notifications-badge');
        if (!badge && count > 0) {
            badge = document.createElement('span');
            badge.className = 'notifications-badge';
            btn.appendChild(badge);
        }
        if (badge) {
            if (count > 0) badge.textContent = String(count > 99 ? '99+' : count);
            else badge.remove();
        }
        if (typeof window.updateGlobalUnreadIndicator === 'function') {
            try { window.updateGlobalUnreadIndicator(count); } catch (e) {}
        }
    };

    const fetchNotis = async () => {
        const sessionUser = JSON.parse(sessionStorage.getItem('user') || 'null');
        if (!sessionUser || !sessionUser.id) return [];

        const params = new URLSearchParams({ usr_id: String(sessionUser.id), order: 'desc' });
        try {
            const res = await fetch('/api/notifications?' + params.toString());
            const data = await res.json();
            if (!data.success) return [];
            // map types for readability
            const types = Object.fromEntries((data.types || []).map(t => [t.id, t.name]));
            const items = (data.notifications || []).slice(0, PAGE_LIMIT).map(n => ({
                ...n,
                type_name: types[n.type_id] || null
            }));
            return items;
        } catch (e) {
            return [];
        }
    };

    const openDropdown = async () => {
        btn.setAttribute('aria-expanded', 'true');
        dropdown.classList.remove('hidden');
        const items = await fetchNotis();
        renderList(items);
    };

    const closeDropdown = () => {
        btn.setAttribute('aria-expanded', 'false');
        dropdown.classList.add('hidden');
    };

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdown.classList.contains('hidden')) openDropdown(); else closeDropdown();
    });

    // delegation for delete and mark-read on click
    list.addEventListener('click', async (e) => {
        const del = e.target.closest('.nd-delete');
        const itemEl = e.target.closest('.nd-item');
        if (del) {
            const id = del.getAttribute('data-id');
            if (!id) return;
            try {
                const sessionUser = JSON.parse(sessionStorage.getItem('user') || 'null');
                const res = await fetch('/api/notifications/' + encodeURIComponent(id), {
                    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usr_id: sessionUser?.id })
                });
                const rj = await res.json();
                if (rj.success) {
                    itemEl?.remove();
                    // refresh badge count
                    const remaining = Array.from(list.querySelectorAll('.nd-item')).filter(i => !i.classList.contains('read')).length;
                    updateBadge(remaining);
                }
            } catch (err) {}
            return;
        }

        if (itemEl) {
            const id = itemEl.getAttribute('data-id');
            const alreadyRead = itemEl.getAttribute('data-read') === 'true';
            if (alreadyRead) return;
            try {
                const sessionUser = JSON.parse(sessionStorage.getItem('user') || 'null');
                const res = await fetch('/api/notifications/' + encodeURIComponent(id) + '/read', {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usr_id: sessionUser?.id })
                });
                const rj = await res.json();
                if (rj.success) {
                    itemEl.classList.remove('unread');
                    itemEl.setAttribute('data-read', 'true');
                    // recompute badge
                    const remaining = Array.from(list.querySelectorAll('.nd-item')).filter(i => i.getAttribute('data-read') !== 'true').length;
                    updateBadge(remaining);
                }
            } catch (err) {}
        }
    });

    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const sessionUser = JSON.parse(sessionStorage.getItem('user') || 'null');
            if (!sessionUser || !sessionUser.id) return;
            if (!confirm('¿Borrar todas las notificaciones?')) return;
            try {
                const res = await fetch('/api/notifications/delete-all', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usr_id: sessionUser.id })
                });
                const rj = await res.json();
                if (rj.success) {
                    list.innerHTML = '<div class="nd-empty">Sin notificaciones</div>';
                    updateBadge(0);
                }
            } catch (err) {}
        });
    }

    // keyboard escape
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDropdown(); });
});
