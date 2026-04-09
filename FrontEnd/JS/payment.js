document.addEventListener('DOMContentLoaded', async () => {
    const depInput = document.getElementById('pay-department');
    const monthInput = document.getElementById('pay-month');
    const amountPaidInput = document.getElementById('pay-amount');
    const amountExpectedInput = document.getElementById('pay-expected');
    const yearInput = document.getElementById('pay-year');
    const saveBtn = document.getElementById('save-payment-btn');

    const fltDepartment = document.getElementById('flt-department');
    const fltMonth = document.getElementById('flt-month');
    const fltYear = document.getElementById('flt-year');
    const tbody = document.getElementById('payments-tbody');

    const paginationBox = document.getElementById('payments-pagination');
    const prevBtn = document.getElementById('pay-prev-btn');
    const nextBtn = document.getElementById('pay-next-btn');
    const pageIndicator = document.getElementById('pay-page-indicator');
    const downloadBtn = document.getElementById('download-btn');

    const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const PAGE_SIZE = 10;
    let currentPage = 1;
    let allRows = [];
    let filteredRows = [];
    let quotas = [];
    let allDepartments = [];

    const now = new Date();
    yearInput.value = now.getFullYear();

    monthInput.innerHTML = MONTHS.map((m, idx) => `<option value="${m}" ${idx === now.getMonth() ? 'selected' : ''}>${m}</option>`).join('');
    fltMonth.innerHTML += MONTHS.map(m => `<option value="${m}">${m}</option>`).join('');

    try {
        const res = await fetch('/api/accounting/payment-data');
        const data = await res.json();

        if (!data.success) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Error al cargar datos</td></tr>';
            return;
        }

        quotas = data.quotas || [];
        allRows = data.receipts || [];

        allDepartments = [...(data.departments || [])].sort((a, b) => compareDepartmentNames(a.name, b.name));
        fltDepartment.innerHTML += allDepartments.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
        refreshAvailableDepartments();

        const uniqueYears = [...new Set(allRows.map(r => r.year).filter(Boolean))].sort((a, b) => b - a);
        fltYear.innerHTML += uniqueYears.map(y => `<option value="${y}">${y}</option>`).join('');

        autoFillExpectedAmount();
        applyFilters();
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Error de red</td></tr>';
        return;
    }

    monthInput.addEventListener('change', () => {
        autoFillExpectedAmount();
        refreshAvailableDepartments();
    });

    yearInput.addEventListener('input', () => {
        autoFillExpectedAmount();
        refreshAvailableDepartments();
    });

    saveBtn.addEventListener('click', async () => {
        const depId = depInput.value;
        const month = monthInput.value;
        const year = parseInt(yearInput.value, 10);
        const amountPaid = parseFloat(amountPaidInput.value);
        const amountExpected = parseFloat(amountExpectedInput.value);

        if (!depId) {
            Swal.fire({ icon: 'warning', title: 'Sin departamentos disponibles', text: 'Solo puedes registrar departamentos que no han pagado en ese mes y año.' });
            return;
        }

        if (!month) {
            Swal.fire({ icon: 'warning', title: 'Falta mes', text: 'Selecciona el mes correspondiente.' });
            return;
        }

        if (isNaN(year) || year < 2000) {
            Swal.fire({ icon: 'warning', title: 'Año inválido', text: 'Ingresa un año válido.' });
            return;
        }

        if (isNaN(amountPaid) || amountPaid < 0) {
            Swal.fire({ icon: 'warning', title: 'Cantidad pagada invalida', text: 'Ingresa una cantidad pagada valida.' });
            return;
        }

        if (isNaN(amountExpected) || amountExpected <= 0) {
            Swal.fire({ icon: 'warning', title: 'Cantidad esperada invalida', text: 'Ingresa la cuota esperada.' });
            return;
        }

        saveBtn.disabled = true;

        try {
            const r = await fetch('/api/accounting/payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dep_id: depId,
                    year,
                    month,
                    amount_paid: amountPaid,
                    amount_expected: amountExpected
                })
            });

            const result = await r.json();
            if (!result.success) {
                Swal.fire({ icon: 'error', title: 'Error', text: result.message || 'No se pudo guardar el pago.' });
                return;
            }

            await Swal.fire({
                icon: 'success',
                title: 'Pago guardado',
                text: 'El pago de cuota se registro correctamente.',
                timer: 1600,
                timerProgressBar: true,
                showConfirmButton: false
            });

            refreshData();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Fallo de red al guardar.' });
        } finally {
            saveBtn.disabled = false;
        }
    });

    fltDepartment.addEventListener('change', applyFilters);
    fltMonth.addEventListener('change', applyFilters);
    fltYear.addEventListener('change', applyFilters);

    prevBtn.addEventListener('click', () => {
        if (currentPage <= 1) return;
        currentPage -= 1;
        renderTable(filteredRows);
    });

    nextBtn.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
        if (currentPage >= totalPages) return;
        currentPage += 1;
        renderTable(filteredRows);
    });

    downloadBtn.addEventListener('click', () => {
        const rows = (filteredRows.length ? filteredRows : allRows)
            .slice()
            .sort((a, b) => compareRowsByDepartment(a, b));
        const header = ['Año', 'Departamento', 'Mes'];
        const body = rows.map(r => [r.year, r.department_name || `DEP ${r.dep_id}`, r.month]);
        const csv = [header, ...body]
            .map(cols => cols.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pagos_cuota.csv';
        link.click();
        URL.revokeObjectURL(url);
    });

    async function refreshData() {
        const res = await fetch('/api/accounting/payment-data');
        const data = await res.json();
        if (!data.success) return;

        allRows = data.receipts || [];
        quotas = data.quotas || [];
        allDepartments = [...(data.departments || [])].sort((a, b) => compareDepartmentNames(a.name, b.name));

        const uniqueYears = [...new Set(allRows.map(r => r.year).filter(Boolean))].sort((a, b) => b - a);
        fltYear.innerHTML = '<option value="any">Cualquiera</option>' + uniqueYears.map(y => `<option value="${y}">${y}</option>`).join('');

        refreshAvailableDepartments();
        applyFilters();
    }

    function refreshAvailableDepartments() {
        const month = String(monthInput.value || '').trim();
        const year = parseInt(yearInput.value, 10);

        if (!month || isNaN(year)) {
            depInput.innerHTML = '<option value="">Selecciona</option>';
            return;
        }

        const paidSet = new Set(
            allRows
                .filter(r => String(r.month || '').trim() === month && Number(r.year) === year)
                .map(r => String(r.dep_id))
        );

        const available = allDepartments
            .filter(dep => !paidSet.has(String(dep.id)))
            .sort((a, b) => compareDepartmentNames(a.name, b.name));
        depInput.innerHTML = '<option value="">Selecciona</option>' +
            available.map(dep => `<option value="${dep.id}">${escapeHtml(dep.name)}</option>`).join('');
    }

    function autoFillExpectedAmount() {
        const month = String(monthInput.value || '').toLowerCase();
        const year = parseInt(yearInput.value, 10);
        const quota = quotas.find(q => String(q.month || '').toLowerCase() === month && Number(q.year) === year);
        if (quota && quota.amount !== null && quota.amount !== undefined) {
            amountExpectedInput.value = parseFloat(quota.amount).toFixed(2);
        }
    }

    function applyFilters() {
        let rows = [...allRows];

        if (fltDepartment.value !== 'any') {
            rows = rows.filter(r => String(r.dep_id) === String(fltDepartment.value));
        }

        if (fltMonth.value !== 'any') {
            rows = rows.filter(r => String(r.month) === String(fltMonth.value));
        }

        if (fltYear.value !== 'any') {
            rows = rows.filter(r => String(r.year) === String(fltYear.value));
        }

        rows.sort((a, b) => compareRowsByDepartment(a, b));

        filteredRows = rows;
        currentPage = 1;
        renderTable(filteredRows);
    }

    function compareRowsByDepartment(a, b) {
        const depA = String(a.department_name || `DEP ${a.dep_id}`);
        const depB = String(b.department_name || `DEP ${b.dep_id}`);
        const depCmp = compareDepartmentNames(depA, depB);
        if (depCmp !== 0) return depCmp;

        return Number(b.year || 0) - Number(a.year || 0);
    }

    function compareDepartmentNames(a, b) {
        return String(a || '').localeCompare(String(b || ''), 'es', { numeric: true, sensitivity: 'base' });
    }

    function renderTable(rows) {
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Sin pagos registrados</td></tr>';
            paginationBox.style.display = 'none';
            return;
        }

        const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;

        const start = (currentPage - 1) * PAGE_SIZE;
        const items = rows.slice(start, start + PAGE_SIZE);

        paginationBox.style.display = totalPages > 1 ? 'flex' : 'none';
        pageIndicator.textContent = `Pagina ${currentPage} de ${totalPages}`;
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;

        tbody.innerHTML = items.map(r => `
            <tr>
                <td>${escapeHtml(r.year)}</td>
                <td>${escapeHtml(r.department_name || `DEP ${r.dep_id}`)}</td>
                <td>${escapeHtml(r.month || '-')}</td>
            </tr>
        `).join('');
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});
