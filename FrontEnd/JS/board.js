document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('incidents-tbody');
    const typeSelect = document.getElementById('type');
    const areaSelect = document.getElementById('area');
    const statusSelect = document.getElementById('status');
    const orderSelect = document.getElementById('order-by');

    let allIncidents = [];
    let typesMap = {};
    let areasMap = {};
    let statusesMap = {};

    try {
        const response = await fetch('/api/incidents');
        const data = await response.json();

        if (!data.success) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Error al cargar incidencias</td></tr>';
            return;
        }

        // Build lookup maps { id -> name }
        typesMap   = Object.fromEntries((data.types   ?? []).map(t => [t.id, t.name ?? t.type ?? t.id]));
        areasMap   = Object.fromEntries((data.areas   ?? []).map(a => [a.id, a.name ?? a.area ?? a.id]));
        statusesMap = Object.fromEntries((data.statuses ?? []).map(s => [s.id, s.name ?? s.status ?? s.id]));

        allIncidents = data.incidents;
        populateFilters(data.types, data.areas, data.statuses);
        renderTable(allIncidents);
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Error al cargar incidencias</td></tr>';
        return;
    }

    typeSelect.addEventListener('change', applyFilters);
    areaSelect.addEventListener('change', applyFilters);
    statusSelect.addEventListener('change', applyFilters);
    orderSelect.addEventListener('change', applyFilters);

    function populateFilters(types, areas, statuses) {
        (types ?? []).slice().sort((a, b) => a.id - b.id).forEach(type => {
            const opt = document.createElement('option');
            opt.value = type.id;
            opt.textContent = type.name ?? type.type ?? type.id;
            typeSelect.appendChild(opt);
        });

        (areas ?? []).forEach(area => {
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

    function applyFilters() {
        let filtered = [...allIncidents];

        const type = typeSelect.value;
        if (type !== 'any') filtered = filtered.filter(i => String(i.type_id) === String(type));

        const area = areaSelect.value;
        if (area !== 'any') filtered = filtered.filter(i => String(i.area_id) === String(area));

        const status = statusSelect.value;
        if (status !== 'any') filtered = filtered.filter(i => String(i.status_id) === String(status));

        const order = orderSelect.value;
        filtered.sort((a, b) => {
            const da = new Date(a.created_at);
            const db = new Date(b.created_at);
            return order === 'timedown' ? db - da : da - db;
        });

        renderTable(filtered);
    }

    tbody.addEventListener('click', (e) => {
        const row = e.target.closest('.clickable-row');
        if (row) window.location.href = `/incident?id=${row.dataset.id}`;
    });

    function renderTable(incidents) {
        if (!incidents.length) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Sin incidencias</td></tr>';
            return;
        }

        tbody.innerHTML = incidents.map(inc => {

            const date = inc.created_at
                ? new Date(inc.created_at).toLocaleString('es-MX', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                })
                : '-';
            const typeName   = escapeHtml(typesMap[inc.type_id]   ?? inc.type_id   ?? '-');
            const areaName   = escapeHtml(areasMap[inc.area_id]   ?? inc.area_id   ?? '-');
            const statusName = escapeHtml(statusesMap[inc.status_id] ?? inc.status_id ?? '-');
            const content    = escapeHtml(inc.content ?? inc.description ?? '');

            return `
                <tr class="clickable-row" data-id="${inc.id}" style="cursor:pointer">
                    <td>
                        <h2>${typeName}</h2>
                        <p>${content}</p>
                        <small><strong>Área:</strong> ${areaName}</small>
                    </td>
                    <td>${date}</td>
                    <td>${statusName}</td>
                </tr>`;
        }).join('');
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});

