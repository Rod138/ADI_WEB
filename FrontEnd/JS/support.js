// support.js - fetch minimal data from remote ADI-SOPORTE service
(function () {
    const BASE = 'https://adi-backend-umber.vercel.app';
    let faqCache = [];

    const normalizeText = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    async function fetchJson(path, opts = {}) {
        const res = await fetch(BASE + path, Object.assign({ cache: 'no-store', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } }, opts));
        const text = await res.text();
        let parsed = null;
        try { parsed = text ? JSON.parse(text) : null } catch (e) { parsed = text }
        if (!res.ok) throw new Error(`${res.status} ${res.statusText} - ${text}`);
        return parsed;
    }

    async function loadAreas() {
        const listEl = document.getElementById('areas-list');
        const select = document.getElementById('ticket-area-select');
        if (!listEl && !select) return;
        try {
            const data = await fetchJson('/api/areas');
            if (listEl) listEl.innerHTML = '';
            select && (select.innerHTML = '<option value="">Selecciona un\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0área</option>');
            const items = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);
            if (!items.length) {
                if (listEl) listEl.textContent = 'Sin datos';
                return;
            }
            items.forEach(a => {
                if (listEl) {
                    const li = document.createElement('li');
                    li.textContent = a.name || a.label || JSON.stringify(a);
                    listEl.appendChild(li);
                }
                if (select) {
                    const opt = document.createElement('option');
                    opt.value = a.id || a.area_id || a._id || '';
                    opt.textContent = a.name || a.label || opt.value;
                    select.appendChild(opt);
                }
            });
        } catch (err) {
            if (listEl) listEl.textContent = 'Error cargando áreas: ' + err.message;
        }
    }

    async function loadFaqs() {
        const container = document.getElementById('faqs-list');
        if (!container) return;
        const searchInput = document.getElementById('faq-search');
        try {
            const data = await fetchJson('/api/faqs');
            faqCache = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);

            const renderFaqs = (query = '') => {
                const normalizedQuery = normalizeText(query.trim());
                const filtered = faqCache.filter((faq) => {
                    if (!normalizedQuery) return true;
                    const question = normalizeText(faq.question || faq.title || '');
                    const answer = normalizeText(faq.answer || faq.body || '');
                    return question.includes(normalizedQuery) || answer.includes(normalizedQuery);
                });

                container.innerHTML = '';
                if (filtered.length === 0) {
                    container.textContent = normalizedQuery ? 'No se encontraron resultados.' : 'Sin preguntas frecuentes.';
                    return;
                }

                filtered.forEach((f) => {
                    const el = document.createElement('div');
                    el.className = 'faq-item';

                    const q = document.createElement('strong');
                    q.textContent = f.question || f.title || '';

                    const a = document.createElement('div');
                    a.textContent = f.answer || f.body || '';

                    el.appendChild(q);
                    el.appendChild(a);
                    container.appendChild(el);
                });
            };

            renderFaqs(searchInput?.value || '');

            if (searchInput && !searchInput.dataset.bound) {
                searchInput.dataset.bound = 'true';
                searchInput.addEventListener('input', () => renderFaqs(searchInput.value));
            }
        } catch (err) {
            container.textContent = 'Error cargando FAQs: ' + err.message;
        }
    }

    async function loadErrorTypes(areaId) {
        const select = document.getElementById('ticket-error-select');
        if (!select) return;
        select.innerHTML = '<option value="">Cargando...</option>';
        if (!areaId) {
            select.innerHTML = '<option value="">Seleccione un tipo</option>';
            return;
        }
        try {
            const data = await fetchJson('/api/error-types/area/' + areaId);
            const items = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);
            select.innerHTML = '<option value="">Seleccione un tipo</option>';
            items.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id || t.error_type_id || '';
                opt.textContent = t.name || t.label || JSON.stringify(t);
                select.appendChild(opt);
            });
        } catch (err) {
            select.innerHTML = '<option value="">Error cargando tipos</option>';
        }
    }

    async function loadTicketsForUser(adiUserId) {
        const container = document.getElementById('tickets-list');
        if (!container) return;
        if (!adiUserId) { container.textContent = 'Proporcione un ID válido.'; return }
        container.innerHTML = 'Cargando...';
        try {
            const data = await fetchJson('/api/tickets/user/' + encodeURIComponent(adiUserId));
            const items = (data && data.data) || [];
            if (!items.length) { container.textContent = 'No se encontraron tickets.'; return }
            container.innerHTML = '';
            items.forEach(t => {
                const el = document.createElement('div');
                el.style.borderBottom = '1px solid #eee';
                el.style.padding = '0.5rem 0';
                el.innerHTML = `<strong>#${t.id || t.ticket_id || ''} - ${t.title || t.subject || 'Ticket'}</strong>
                    <div>${t.description || t.body || ''}</div>
                    <div style="font-size:0.85rem;color:#666">Estado: ${t.status || t.state || 'N/A'}</div>`;
                container.appendChild(el);
            });
        } catch (err) {
            container.textContent = 'Error cargando tickets: ' + err.message;
        }
    }

    async function createTicket(payload) {
        try {
            const res = await fetchJson('/api/tickets', { method: 'POST', body: JSON.stringify(payload) });
            return res;
        } catch (err) {
            throw err;
        }
    }

    async function init() {
        document.getElementById('refresh-btn')?.addEventListener('click', () => {
            loadAreas(); loadFaqs();
        });

        // Area change -> load error types
        document.getElementById('ticket-area-select')?.addEventListener('change', (e) => {
            const areaId = e.target.value;
            loadErrorTypes(areaId);
        });

        // Load tickets for user button
        document.getElementById('load-tickets-btn')?.addEventListener('click', () => {
            const val = document.getElementById('tickets-user-id')?.value;
            loadTicketsForUser(val);
        });

        // Create ticket form
        const form = document.getElementById('create-ticket-form');
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const payload = {
                adi_user_id: Number(fd.get('adi_user_id')),
                adi_rol_id: Number(fd.get('adi_rol_id')),
                area_id: Number(fd.get('area_id')),
                error_type_id: Number(fd.get('error_type_id')),
                description: (fd.get('description') || '').toString(),
                evidence_url: (fd.get('evidence_url') || '') || null,
            };

            try {
                const resp = await createTicket(payload);
                if (resp && resp.ok) {
                    Swal.fire({ icon: 'success', title: 'Ticket creado', text: 'Se creó el ticket correctamente.' });
                    form.reset();
                    // refresh tickets list for this user
                    const uid = payload.adi_user_id;
                    loadTicketsForUser(uid);
                } else {
                    const msg = (resp && resp.errors) ? JSON.stringify(resp.errors) : JSON.stringify(resp);
                    Swal.fire({ icon: 'error', title: 'Error', text: msg });
                }
            } catch (err) {
                Swal.fire({ icon: 'error', title: 'Error', text: err.message });
            }
        });

        await Promise.all([loadAreas(), loadFaqs()]);
        // Menu buttons: highlight active and smooth scroll behavior
        const menuButtons = Array.from(document.querySelectorAll('.support-menu-btn'));
        function setActiveByHash() {
            const hash = window.location.hash || '#areas';
            menuButtons.forEach(b => b.classList.toggle('active', b.getAttribute('href') === hash));
        }
        menuButtons.forEach(b => b.addEventListener('click', () => {
            // active class will update on hashchange after navigation
            setTimeout(setActiveByHash, 100);
        }));
        window.addEventListener('hashchange', setActiveByHash);
        setActiveByHash();
        // menu-card behavior: coming soon handler
        document.querySelectorAll('.menu-card.soon').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const href = btn.getAttribute('href') || '#';
                const feature = btn.dataset.feature || 'Función';
                if (typeof Swal !== 'undefined' && Swal.fire) {
                    Swal.fire({ icon: 'info', title: feature + ' próximamente', text: 'Esta funcionalidad estará disponible pronto.' });
                } else {
                    alert(feature + ' próximamente');
                }
                // optionally scroll to anchor if desired when ready
                // location.hash = href;
            });
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
