/**
 * TESINA: Tablero de comprobantes para consulta masiva.
 * Responsabilidad: aplicar filtros por validacion/fecha/departamento y paginar.
 * Objetivo: facilitar auditoria y seguimiento de evidencias de pago.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('receipts-tbody');
    const validationSelect = document.getElementById('validation');
    const dateSelect = document.getElementById('date');
    const departmentSelect = document.getElementById('department');
    const orderSelect = document.getElementById('order-by');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    const paginationBox = document.getElementById('receipts-pagination');
    const prevBtn = document.getElementById('rcp-prev-btn');
    const nextBtn = document.getElementById('rcp-next-btn');
    const pageIndicator = document.getElementById('rcp-page-indicator');

    let allReceipts = [];
    let filteredReceipts = [];
    const PAGE_SIZE = 10;
    let currentPage = 1;

    try {
        const response = await fetch('/api/accounting/receipts');
        const data = await response.json();

        if (!data.success) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Error al cargar comprobantes</td></tr>';
            return;
        }

        allReceipts = data.receipts || [];
        populateFilters(allReceipts, data.departments || []);
        applyFilters();
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Error al cargar comprobantes</td></tr>';
    }

    validationSelect.addEventListener('change', applyFilters);
    dateSelect.addEventListener('change', applyFilters);
    departmentSelect.addEventListener('change', applyFilters);
    orderSelect.addEventListener('change', applyFilters);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);

    prevBtn.addEventListener('click', () => {
        if (currentPage <= 1) return;
        currentPage -= 1;
        renderTable(filteredReceipts);
    });

    nextBtn.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(filteredReceipts.length / PAGE_SIZE));
        if (currentPage >= totalPages) return;
        currentPage += 1;
        renderTable(filteredReceipts);
    });

    tbody.addEventListener('click', (e) => {
        const row = e.target.closest('.clickable-row');
        if (row) {
            window.location.href = `/accounting/receipt?id=${encodeURIComponent(row.dataset.id)}`;
        }
    });

    // Carga opciones de filtros de fecha y departamento desde los comprobantes recibidos.
    function populateFilters(receipts, departments) {
        const uniqueDateKeys = [...new Set(
            receipts
                .filter(r => r.created_at)
                .map(r => formatMonthYearKey(r.created_at))
        )];

        uniqueDateKeys.forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key;
            dateSelect.appendChild(option);
        });

        (departments || []).slice().sort((a, b) => Number(a.id) - Number(b.id)).forEach(dep => {
            const option = document.createElement('option');
            option.value = String(dep.id);
            option.textContent = dep.name;
            departmentSelect.appendChild(option);
        });
    }

    // Filtra comprobantes por estado, periodo y departamento.
    function applyFilters() {
        let filtered = [...allReceipts];

        const validation = validationSelect.value;
        if (validation !== 'any') {
            filtered = filtered.filter(r => receiptStatus(r.validated) === validation);
        }

        const date = dateSelect.value;
        if (date !== 'any') {
            filtered = filtered.filter(r => formatMonthYearKey(r.created_at) === date);
        }

        const dep = departmentSelect.value;
        if (dep !== 'any') {
            filtered = filtered.filter(r => String(r.dep_id) === dep);
        }

        const orderBy = orderSelect.value;
        filtered.sort((a, b) => {
            const da = new Date(a.created_at);
            const db = new Date(b.created_at);
            return orderBy === 'timedown' ? db - da : da - db;
        });

        filteredReceipts = filtered;
        currentPage = 1;
        renderTable(filteredReceipts);
    }

    function clearFilters() {
        validationSelect.value = 'any';
        dateSelect.value = 'any';
        departmentSelect.value = 'any';
        orderSelect.value = 'timedown';
        applyFilters();
    }

    // Renderiza la tabla paginada de comprobantes para auditoria operativa.
    function renderTable(receipts) {
        if (!receipts.length) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Sin comprobantes</td></tr>';
            paginationBox.style.display = 'none';
            return;
        }

        const totalPages = Math.max(1, Math.ceil(receipts.length / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = receipts.slice(start, start + PAGE_SIZE);

        paginationBox.style.display = totalPages > 1 ? 'flex' : 'none';
        pageIndicator.textContent = `Pagina ${currentPage} de ${totalPages}`;
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;

        tbody.innerHTML = pageItems.map(r => {
            const status = receiptStatus(r.validated); // 'approved' | 'rejected' | 'pending'
            let validatedText = 'Pendiente';
            if (status === 'approved') validatedText = 'Validado';
            else if (status === 'rejected') validatedText = 'Rechazado';
            const statusClass = normalizeStatusClass(validatedText);
            const statusHtml = `<span class="status-badge status-${statusClass}">${validatedText}</span>`;
            const dateText = r.created_at
                ? new Date(r.created_at).toLocaleString('es-MX', {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })
                : '-';

            const depText = escapeHtml(r.department_name || `DEP ${r.dep_id}`);

            return `
                <tr class="clickable-row" data-id="${r.id}" style="cursor:pointer">
                    <td>
                        <h2 class="receipt-department">${depText}</h2>
                    </td>
                    <td>${dateText}</td>
                    <td>${statusHtml}</td>
                </tr>
            `;
        }).join('');
    }

    // Normaliza texto a clase CSS segura para badges
    function normalizeStatusClass(str) {
        return String(str || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9\-]/g, '') || 'unknown';
    }

    // Compatibilidad de estado: backend actual usa boolean, pero puede existir legado con 1/2.
    function receiptStatus(value) {
        // returns 'approved' | 'rejected' | 'pending'
        if (value === true) return 'approved';
        if (value === false) return 'rejected';
        if (value === null || value === undefined) return 'pending';

        if (typeof value === 'number') {
            if (value === 2) return 'approved';
            if (value === 1) return 'rejected';
            return 'pending';
        }

        const normalized = String(value).trim().toLowerCase();
        if (normalized === 'true' || normalized === '2') return 'approved';
        if (normalized === 'false' || normalized === '1') return 'rejected';
        if (normalized === 'null' || normalized === '') return 'pending';
        return 'pending';
    }

    // Normaliza fecha a clave mensual para filtros agrupados.
    function formatMonthYearKey(dateValue) {
        if (!dateValue) return '-';
        const d = new Date(dateValue);
        return d.toLocaleString('es-MX', { month: 'long', year: 'numeric' });
    }

    // Escapa texto para evitar inyeccion de marcado en celdas.
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});
