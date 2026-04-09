document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('receipts-tbody');
    const validationSelect = document.getElementById('validation');
    const dateSelect = document.getElementById('date');
    const departmentSelect = document.getElementById('department');
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

        (departments || []).forEach(dep => {
            const option = document.createElement('option');
            option.value = String(dep.id);
            option.textContent = dep.name;
            departmentSelect.appendChild(option);
        });
    }

    function applyFilters() {
        let filtered = [...allReceipts];

        const validation = validationSelect.value;
        if (validation !== 'any') {
            const asBool = validation === 'true';
            filtered = filtered.filter(r => Boolean(r.validated) === asBool);
        }

        const date = dateSelect.value;
        if (date !== 'any') {
            filtered = filtered.filter(r => formatMonthYearKey(r.created_at) === date);
        }

        const dep = departmentSelect.value;
        if (dep !== 'any') {
            filtered = filtered.filter(r => String(r.dep_id) === dep);
        }

        filteredReceipts = filtered;
        currentPage = 1;
        renderTable(filteredReceipts);
    }

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
            const validatedText = r.validated ? 'Validado' : 'Pendiente';
            const dateText = r.created_at
                ? new Date(r.created_at).toLocaleString('es-MX', {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })
                : '-';

            const depText = escapeHtml(r.department_name || `DEP ${r.dep_id}`);

            return `
                <tr class="clickable-row" data-id="${r.id}" style="cursor:pointer">
                    <td>${validatedText}</td>
                    <td>${dateText}</td>
                    <td>${depText}</td>
                </tr>
            `;
        }).join('');
    }

    function formatMonthYearKey(dateValue) {
        if (!dateValue) return '-';
        const d = new Date(dateValue);
        return d.toLocaleString('es-MX', { month: 'long', year: 'numeric' });
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});
