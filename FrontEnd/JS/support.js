// support.js - fetch minimal data from remote ADI-SOPORTE service
(function () {
    const BASE = 'https://adi-backend-umber.vercel.app';
    let faqCache = [];
    let areaCache = [];

    const normalizeText = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    async function fetchJson(path, opts = {}) {
        const response = await fetch(BASE + path, Object.assign({
            cache: 'no-store',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            }
        }, opts));

        const text = await response.text();
        let parsed = null;

        try {
            parsed = text ? JSON.parse(text) : null;
        } catch {
            parsed = text;
        }

        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText} - ${text}`);
        }

        return parsed;
    }

    async function loadAreas() {
        const listEl = document.getElementById('areas-list');
        const select = document.getElementById('ticket-area-select');
        return await withLock('support-loadAreas', async () => {
            try {
                const data = await fetchJson('/api/areas');
                const items = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
                areaCache = items;

                if (!listEl && !select) return;

                if (listEl) listEl.innerHTML = '';
                if (select) select.innerHTML = '<option value="">Selecciona un área</option>';

                if (!items.length) {
                    if (listEl) listEl.textContent = 'Sin datos';
                    return;
                }

                items.forEach((area) => {
                    if (listEl) {
                        const li = document.createElement('li');
                        li.textContent = area.name || area.label || JSON.stringify(area);
                        listEl.appendChild(li);
                    }

                    if (select) {
                        const option = document.createElement('option');
                        option.value = area.id || area.area_id || area._id || '';
                        option.textContent = area.name || area.label || option.value;
                        select.appendChild(option);
                    }
                });
            } catch (err) {
                if (listEl) listEl.textContent = 'Error cargando áreas: ' + err.message;
            }
        });
    }

    async function loadFaqs() {
        const container = document.getElementById('faqs-list');
        if (!container) return;
        const searchInput = document.getElementById('faq-search');

        return await withLock('support-loadFaqs', async () => {
            try {
                if (!areaCache.length) {
                    try {
                        await loadAreas();
                    } catch {
                        areaCache = [];
                    }
                }

                const data = await fetchJson('/api/faqs');
                faqCache = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);

                const getAreaId = (faq) => faq?.area_id ?? faq?.areaId ?? faq?.area?.id ?? faq?.areas?.id ?? faq?.areas_id ?? faq?.area;
                const getAreaLabel = (faq) => {
                    const directLabel = faq?.area_name || faq?.areaLabel || faq?.area_label || faq?.areaTitle || faq?.area_title;
                    if (directLabel) return String(directLabel);

                    const nestedArea = faq?.area || faq?.areas;
                    if (nestedArea && typeof nestedArea === 'object') {
                        return nestedArea.name || nestedArea.label || nestedArea.title || String(nestedArea.id || 'Sin área');
                    }

                    const areaId = getAreaId(faq);
                    const matchedArea = areaCache.find((area) => String(area.id || area.area_id || area._id || '') === String(areaId || ''));
                    return matchedArea?.name || matchedArea?.label || matchedArea?.title || (areaId ? `Área ${areaId}` : 'Sin área');
                };

                const groupFaqsByArea = (items) => {
                    return items.reduce((acc, faq) => {
                        const areaLabel = getAreaLabel(faq);
                        if (!acc[areaLabel]) acc[areaLabel] = [];
                        acc[areaLabel].push(faq);
                        return acc;
                    }, {});
                };

                const renderFaqs = (query = '') => {
                    const normalizedQuery = normalizeText(query.trim());
                    const filtered = faqCache.filter((faq) => {
                        if (!normalizedQuery) return true;
                        const question = normalizeText(faq.question || faq.title || '');
                        const answer = normalizeText(faq.answer || faq.body || '');
                        return question.includes(normalizedQuery) || answer.includes(normalizedQuery);
                    });

                    container.innerHTML = '';

                    if (!filtered.length) {
                        container.innerHTML = `<div class="faq-empty">${normalizedQuery ? 'No se encontraron resultados.' : 'Sin preguntas frecuentes.'}</div>`;
                        return;
                    }

                    const groupedFaqs = groupFaqsByArea(filtered);
                    const areaNames = Object.keys(groupedFaqs).sort((a, b) => a.localeCompare(b, 'es'));

                    areaNames.forEach((areaName) => {
                        const areaCard = document.createElement('section');
                        areaCard.className = 'faq-area-card';

                        const areaTitle = document.createElement('h3');
                        areaTitle.className = 'faq-area-title';

                        const toggleIcon = document.createElement('span');
                        toggleIcon.className = 'material-symbols-outlined toggle-icon';
                        toggleIcon.textContent = 'expand_more';

                        const titleText = document.createElement('span');
                        titleText.textContent = areaName;

                        areaTitle.appendChild(toggleIcon);
                        areaTitle.appendChild(titleText);

                        areaTitle.addEventListener('click', () => {
                            areaCard.classList.toggle('collapsed');
                        });

                        const areaList = document.createElement('div');
                        areaList.className = 'faq-area-list';

                        groupedFaqs[areaName].forEach((faq) => {
                            const item = document.createElement('div');
                            item.className = 'faq-item';

                            const question = document.createElement('strong');
                            question.textContent = faq.question || faq.title || '';

                            const answer = document.createElement('div');
                            answer.textContent = faq.answer || faq.body || '';

                            item.appendChild(question);
                            item.appendChild(answer);
                            areaList.appendChild(item);
                        });

                        areaCard.appendChild(areaTitle);
                        areaCard.appendChild(areaList);
                        container.appendChild(areaCard);
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
        });
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
            const items = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
            select.innerHTML = '<option value="">Seleccione un tipo</option>';

            items.forEach((type) => {
                const option = document.createElement('option');
                option.value = type.id || type.error_type_id || '';
                option.textContent = type.name || type.label || JSON.stringify(type);
                select.appendChild(option);
            });
        } catch {
            select.innerHTML = '<option value="">Error cargando tipos</option>';
        }
    }

    async function loadTicketsForUser(adiUserId) {
        const container = document.getElementById('tickets-list');
        if (!container) return;

        if (!adiUserId) {
            container.textContent = 'Proporcione un ID válido.';
            return;
        }

        container.innerHTML = 'Cargando...';
        try {
            const data = await fetchJson('/api/tickets/user/' + encodeURIComponent(adiUserId));
            const items = (data && data.data) || [];

            if (!items.length) {
                container.textContent = 'No se encontraron tickets.';
                return;
            }

            container.innerHTML = '';
            items.forEach((ticket) => {
                const item = document.createElement('div');
                item.style.borderBottom = '1px solid #eee';
                item.style.padding = '0.5rem 0';
                item.innerHTML = `<strong>#${ticket.id || ticket.ticket_id || ''} - ${ticket.title || ticket.subject || 'Ticket'}</strong>
                    <div>${ticket.description || ticket.body || ''}</div>
                    <div style="font-size:0.85rem;color:#666">Estado: ${ticket.status || ticket.state || 'N/A'}</div>`;
                container.appendChild(item);
            });
        } catch (err) {
            container.textContent = 'Error cargando tickets: ' + err.message;
        }
    }

    async function createTicket(payload) {
        return await fetchJson('/api/tickets', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    async function init() {
        document.getElementById('refresh-btn')?.addEventListener('click', () => {
            loadAreas();
            loadFaqs();
        });

        document.getElementById('ticket-area-select')?.addEventListener('change', (event) => {
            loadErrorTypes(event.target.value);
        });

        document.getElementById('load-tickets-btn')?.addEventListener('click', () => {
            const value = document.getElementById('tickets-user-id')?.value;
            loadTicketsForUser(value);
        });

        const form = document.getElementById('create-ticket-form');
        form?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submitButton = form.querySelector('button[type="submit"]');
            const fd = new FormData(form);
            const payload = {
                adi_user_id: Number(fd.get('adi_user_id')),
                adi_rol_id: Number(fd.get('adi_rol_id')),
                area_id: Number(fd.get('area_id')),
                error_type_id: Number(fd.get('error_type_id')),
                description: (fd.get('description') || '').toString(),
                evidence_url: (fd.get('evidence_url') || '') || null
            };

            await withButtonLock(submitButton, async () => {
                try {
                    const result = await createTicket(payload);
                    if (result && result.ok) {
                        Swal.fire({ icon: 'success', title: 'Ticket creado', text: 'Se creó el ticket correctamente.' });
                        form.reset();
                        loadTicketsForUser(payload.adi_user_id);
                    } else {
                        const msg = result && result.errors ? JSON.stringify(result.errors) : JSON.stringify(result);
                        Swal.fire({ icon: 'error', title: 'Error', text: msg });
                    }
                } catch (err) {
                    Swal.fire({ icon: 'error', title: 'Error', text: err.message });
                }
            }, { loadingText: 'ENVIANDO...' });
        });

        await Promise.all([loadAreas(), loadFaqs()]);

        const menuButtons = Array.from(document.querySelectorAll('.support-menu-btn'));
        const setActiveByHash = () => {
            const hash = window.location.hash || '#areas';
            menuButtons.forEach((button) => {
                button.classList.toggle('active', button.getAttribute('href') === hash);
            });
        };

        menuButtons.forEach((button) => {
            button.addEventListener('click', () => {
                setTimeout(setActiveByHash, 100);
            });
        });

        window.addEventListener('hashchange', setActiveByHash);
        setActiveByHash();

        document.querySelectorAll('.menu-card.soon').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                const feature = button.dataset.feature || 'Función';
                if (typeof Swal !== 'undefined' && Swal.fire) {
                    Swal.fire({ icon: 'info', title: feature + ' próximamente', text: 'Esta funcionalidad estará disponible pronto.' });
                } else {
                    alert(feature + ' próximamente');
                }
            });
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
