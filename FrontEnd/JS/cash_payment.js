document.addEventListener('DOMContentLoaded', async () => {
    const depSelect = document.getElementById('cash-department');
    const monthSelect = document.getElementById('cash-month');
    const yearInput = document.getElementById('cash-year');
    const amountPaidInput = document.getElementById('cash-amount-paid');
    const amountExpectedInput = document.getElementById('cash-amount-expected');
    const confirmInput = document.getElementById('cash-confirm');
    const saveBtn = document.getElementById('cash-save-btn');
    const cancelBtn = document.getElementById('cash-cancel-btn');
    const historyBody = document.getElementById('cash-history-tbody');

    const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    let quotas = [];
    let receipts = [];

    initializeForm();
    await loadData();

    depSelect.addEventListener('change', autofillExpected);
    monthSelect.addEventListener('change', autofillExpected);
    yearInput.addEventListener('input', autofillExpected);
    monthSelect.addEventListener('change', renderHistory);
    yearInput.addEventListener('input', renderHistory);

    saveBtn.addEventListener('click', saveCashPayment);
    cancelBtn.addEventListener('click', resetForm);

    function initializeForm() {
        const now = new Date();
        yearInput.value = now.getFullYear();

        monthSelect.innerHTML = MONTHS
            .map((m, idx) => `<option value="${m}" ${idx === now.getMonth() ? 'selected' : ''}>${m}</option>`)
            .join('');
    }

    async function loadData() {
        try {
            const res = await fetch('/api/accounting/payment-data');
            const result = await res.json();

            if (!result.success) {
                historyBody.innerHTML = '<tr><td colspan="5" style="text-align:center">No se pudo cargar la información.</td></tr>';
                return;
            }

            quotas = result.quotas || [];
            receipts = result.receipts || [];

            const departments = result.departments || [];
            depSelect.innerHTML = departments
                .map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`)
                .join('');

            autofillExpected();
            renderHistory();
        } catch (error) {
            historyBody.innerHTML = '<tr><td colspan="5" style="text-align:center">Error de red.</td></tr>';
        }
    }

    function autofillExpected() {
        const month = String(monthSelect.value || '').toLowerCase();
        const year = parseInt(yearInput.value, 10);

        const quota = quotas.find(q =>
            String(q.month || '').toLowerCase() === month && Number(q.year) === year
        );

        amountExpectedInput.value = quota && quota.amount !== null && quota.amount !== undefined
            ? Number(quota.amount).toFixed(2)
            : '';
    }

    async function saveCashPayment() {
        const depId = parseInt(depSelect.value, 10);
        const month = String(monthSelect.value || '').trim();
        const year = parseInt(yearInput.value, 10);
        const amountPaid = parseFloat(amountPaidInput.value);
        const amountExpected = parseFloat(amountExpectedInput.value);

        if (Number.isNaN(depId)) {
            return notify('Departamento inválido', 'Selecciona un departamento válido.', 'warning');
        }

        if (!month) {
            return notify('Mes faltante', 'Selecciona el mes del pago.', 'warning');
        }

        if (Number.isNaN(year) || year < 2000) {
            return notify('Año inválido', 'Ingresa un año válido.', 'warning');
        }

        if (Number.isNaN(amountPaid) || amountPaid <= 0) {
            return notify('Monto inválido', 'La cantidad pagada debe ser mayor a 0.', 'warning');
        }

        if (Number.isNaN(amountExpected) || amountExpected <= 0) {
            return notify('Cuota esperada inválida', 'Debe existir una cuota esperada válida para ese periodo.', 'warning');
        }

        if (!confirmInput.checked) {
            return notify('Confirmación requerida', 'Marca la confirmación de pago en efectivo.', 'warning');
        }

        saveBtn.disabled = true;

        try {
            const res = await fetch('/api/accounting/payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dep_id: depId,
                    year,
                    month,
                    amount_paid: amountPaid,
                    amount_expected: amountExpected,
                    is_cash: true
                })
            });

            const result = await res.json();
            if (!result.success) {
                notify('Error al guardar', result.message || 'No se pudo registrar el pago en efectivo.', 'error');
                return;
            }

            await Swal.fire({
                title: 'Pago registrado',
                text: 'La cuota en efectivo se registró correctamente.',
                icon: 'success',
                timer: 1500,
                timerProgressBar: true,
                showConfirmButton: false
            });

            resetForm();
            await loadData();
        } catch (error) {
            notify('Error de conexión', 'No se pudo registrar el pago en efectivo.', 'error');
        } finally {
            saveBtn.disabled = false;
        }
    }

    function renderHistory() {
        const selectedMonth = String(monthSelect.value || '').toLowerCase();
        const selectedYear = parseInt(yearInput.value, 10);

        const cashRows = receipts
            .filter(r => (r.url_image === null || r.url_image === '') && r.validated === true)
            .filter(r => String(r.month || '').toLowerCase() === selectedMonth && Number(r.year) === selectedYear)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            ;

        if (!cashRows.length) {
            historyBody.innerHTML = '<tr><td colspan="5" style="text-align:center">Sin registros en el periodo seleccionado.</td></tr>';
            return;
        }

        historyBody.innerHTML = cashRows.map(r => {
            const period = `${escapeHtml(r.month || '-')} ${escapeHtml(r.year || '-')}`;
            const amountPaid = formatCurrency(r.amount_paid);
            const amountExpected = formatCurrency(r.amount_expected);
            const createdAt = r.created_at ? new Date(r.created_at).toLocaleString('es-MX') : '-';

            return `
                <tr>
                    <td>${escapeHtml(r.department_name || `DEP ${r.dep_id}`)}</td>
                    <td>${period}</td>
                    <td>${amountPaid}</td>
                    <td>${amountExpected}</td>
                    <td>${escapeHtml(createdAt)}</td>
                </tr>
            `;
        }).join('');
    }

    function resetForm() {
        amountPaidInput.value = '';
        confirmInput.checked = false;
        initializeForm();
        autofillExpected();
        renderHistory();
    }

    function formatCurrency(value) {
        const n = Number(value);
        if (Number.isNaN(n)) return '-';
        return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function notify(title, text, icon) {
        return Swal.fire({
            title,
            text,
            icon,
            confirmButtonColor: icon === 'error' ? '#d33' : '#ED7A13',
            confirmButtonText: 'Aceptar'
        });
    }
});
