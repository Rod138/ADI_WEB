/**
 * TESINA: Logica cliente del tablero de incidencias.
 * Responsabilidad: cargar incidencias, aplicar filtros y paginar resultados.
 * Flujo UI: obtener datos -> renderizar tabla -> navegar por paginas.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('incidents-tbody');
    const typeSelect = document.getElementById('type');
    const areaSelect = document.getElementById('area');
    const statusSelect = document.getElementById('status');
    const orderSelect = document.getElementById('order-by');
    const creatorSelect = document.getElementById('creator-filter');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    const paginationBox = document.getElementById('incidents-pagination');
    const prevBtn = document.getElementById('inc-prev-btn');
    const nextBtn = document.getElementById('inc-next-btn');
    const pageIndicator = document.getElementById('inc-page-indicator');
    const currentUser = window.ADIAuth?.getCurrentUser?.();

    let allIncidents = [];
    let filteredIncidents = [];
    let typesMap = {};
    let areasMap = {};
    let statusesMap = {};
    const PAGE_SIZE = 10;
    let currentPage = 1;

    try {
        await withLock('incidents-load', async () => {
            const response = await fetch('/api/incidents');
            const data = await response.json();

            if (!data.success) {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Error al cargar incidencias</td></tr>';
                return;
            }

            // Build lookup maps { id -> name }
            typesMap   = Object.fromEntries((data.types   ?? []).slice().sort((a, b) => Number(a.id) - Number(b.id)).map(t => [t.id, t.name ?? t.type ?? t.id]));
            areasMap   = Object.fromEntries((data.areas   ?? []).slice().sort((a, b) => Number(a.id) - Number(b.id)).map(a => [a.id, a.name ?? a.area ?? a.id]));
            statusesMap = Object.fromEntries((data.statuses ?? []).slice().sort((a, b) => Number(a.id) - Number(b.id)).map(s => [s.id, s.name ?? s.status ?? s.id]));

            allIncidents = data.incidents;
            populateFilters(data.types, data.areas, data.statuses);
            applyFilters();
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Error al cargar incidencias</td></tr>';
        return;
    }

    typeSelect.addEventListener('change', applyFilters);
    areaSelect.addEventListener('change', applyFilters);
    statusSelect.addEventListener('change', applyFilters);
    orderSelect.addEventListener('change', applyFilters);
    if (creatorSelect) creatorSelect.addEventListener('change', applyFilters);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);

    // Llena combos de filtro con catalogos recibidos del backend.
    function populateFilters(types, areas, statuses) {
        const seenTypes = new Set();
        (types ?? []).slice().sort((a, b) => a.id - b.id).forEach(type => {
            const name = String(type.name ?? type.type ?? type.id).trim();
            const key = name.toLowerCase();
            if (seenTypes.has(key)) return;
            seenTypes.add(key);
            const opt = document.createElement('option');
            opt.value = type.id;
            opt.textContent = name;
            typeSelect.appendChild(opt);
        });

        (areas ?? []).slice().sort((a, b) => Number(a.id) - Number(b.id)).forEach(area => {
            const opt = document.createElement('option');
            opt.value = area.id;
            opt.textContent = area.name ?? area.area ?? area.id;
            areaSelect.appendChild(opt);
        });

        (statuses ?? []).slice().sort((a, b) => a.id - b.id).forEach(status => {
            const opt = document.createElement('option');
            opt.value = status.id;
            opt.textContent = status.name ?? status.status ?? status.id;
            statusSelect.appendChild(opt);
        });
    }

    // Aplica filtros activos y ordenamiento temporal sobre el dataset completo.
    function applyFilters() {
        let filtered = [...allIncidents];

        const type = typeSelect.value;
        if (type !== 'any') filtered = filtered.filter(i => String(i.type_id) === String(type));

        const area = areaSelect.value;
        if (area !== 'any') filtered = filtered.filter(i => String(i.area_id) === String(area));

        const status = statusSelect.value;
        if (status !== 'any') filtered = filtered.filter(i => String(i.status_id) === String(status));

        // Permite mostrar solo incidencias creadas por el usuario autenticado.
        const creator = creatorSelect?.value ?? 'any';
        if (creator === 'mine' && currentUser?.id) {
            filtered = filtered.filter(i => String(i.usr_id) === String(currentUser.id));
        }

        const order = orderSelect.value;
        filtered.sort((a, b) => {
            const da = new Date(a.created_at);
            const db = new Date(b.created_at);
            return order === 'timedown' ? db - da : da - db;
        });

        filteredIncidents = filtered;
        currentPage = 1;
        renderTable(filteredIncidents);
    }

    function clearFilters() {
        typeSelect.value = 'any';
        areaSelect.value = 'any';
        statusSelect.value = 'any';
        orderSelect.value = 'timedown';
        if (creatorSelect) creatorSelect.value = 'any';
        applyFilters();
    }

    prevBtn.addEventListener('click', () => {
        if (currentPage <= 1) return;
        currentPage -= 1;
        renderTable(filteredIncidents);
    });

    nextBtn.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(filteredIncidents.length / PAGE_SIZE));
        if (currentPage >= totalPages) return;
        currentPage += 1;
        renderTable(filteredIncidents);
    });

    tbody.addEventListener('click', (e) => {
        const row = e.target.closest('.clickable-row');
        if (row) window.location.href = `/incident?id=${row.dataset.id}`;
    });

    // Renderiza solo la pagina actual y actualiza controles de paginacion.
    function renderTable(incidents) {
        if (!incidents.length) {
            tbody.innerHTML = `
                <tr class="create-incident-row">
                    <td colspan="3">
                        <a href="/incident-create" class="btn-create-incident" aria-label="Crear incidencia">
                            <span class="material-symbols-outlined">add_circle</span>
                            <span>CREAR INCIDENCIA</span>
                        </a>
                    </td>
                </tr>
                <tr><td colspan="3" style="text-align:center">Sin incidencias</td></tr>
            `;
            paginationBox.style.display = 'none';
            return;
        }

        const totalPages = Math.max(1, Math.ceil(incidents.length / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = incidents.slice(start, start + PAGE_SIZE);

        paginationBox.style.display = totalPages > 1 ? 'flex' : 'none';
        pageIndicator.textContent = `Pagina ${currentPage} de ${totalPages}`;
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;

        tbody.innerHTML = `
            <tr class="create-incident-row">
                <td colspan="3">
                    <a href="/incident-create" class="btn-create-incident" aria-label="Crear incidencia">
                        <span class="material-symbols-outlined">add_circle</span>
                        <span>CREAR INCIDENCIA</span>
                    </a>
                </td>
            </tr>
            ${pageItems.map(inc => {

            const date = inc.created_at
                ? new Date(inc.created_at).toLocaleString('es-MX', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                })
                : '-';
            const typeName   = escapeHtml(typesMap[inc.type_id]   ?? inc.type_id   ?? '-');
            const areaName   = escapeHtml(areasMap[inc.area_id]   ?? inc.area_id   ?? '-');
            const statusName = escapeHtml(statusesMap[inc.status_id] ?? inc.status_id ?? '-');
            const statusClass = normalizeStatusClass(statusName);
            const rawContent = String(inc.content ?? inc.description ?? '');
            const truncatedContent = truncateText(rawContent, 100);
            const content = escapeHtml(truncatedContent);
            const fullContentAttr = escapeHtml(rawContent).replace(/"/g, '&quot;');

            return `
                <tr class="clickable-row" data-id="${inc.id}" style="cursor:pointer">
                    <td>
                        <h2>${typeName}</h2>
                        <p class="incident-description" title="${fullContentAttr}">${content}</p>
                        <small><strong>Área:</strong> ${areaName}</small>
                    </td>
                    <td>${date}</td>
                    <td><span class="status-badge status-${statusClass}">${statusName}</span></td>
                </tr>`;
        }).join('')}`;
    }

    // Normaliza texto a clase CSS segura para badges
    function normalizeStatusClass(str) {
        return String(str || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9\-]/g, '') || 'unknown';
    }

    // Recorta texto largo para mejorar legibilidad en la tabla.
    function truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return `${text.slice(0, maxLength).trimEnd()}...`;
    }

    // Escapa caracteres especiales para evitar inyeccion HTML en celdas.
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});

