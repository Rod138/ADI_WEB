document.addEventListener('DOMContentLoaded', async () => {
    // ============ DOM References ============
    const currentBalanceText = document.getElementById('current-balance');
    const breakdownFundText = document.getElementById('breakdown-fund');
    const breakdownPaymentsText = document.getElementById('breakdown-payments');
    const breakdownExpensesText = document.getElementById('breakdown-expenses');

    const fundAmountInput = document.getElementById('fund-amount');
    const fundConfirmInput = document.getElementById('fund-confirm');
    const saveFundBtn = document.getElementById('save-fund-btn');
    const currentFundText = document.getElementById('current-fund');
    const updatedAtText = document.getElementById('updated-at');

    const monthInput = document.getElementById('quota-month');
    const yearInput = document.getElementById('quota-year');
    const amountInput = document.getElementById('quota-amount');
    const confirmInput = document.getElementById('quota-confirm');
    const saveQuotaBtn = document.getElementById('save-quota-btn');
    const tbody = document.getElementById('quota-tbody');

    // ============ Constants ============
    const MONTHS = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    // ============ Initialization ============
    initializeQuotaForm();
    await loadFinanceConfig();

    // ============ Event Listeners ============
    saveFundBtn.addEventListener('click', handleSaveFund);
    saveQuotaBtn.addEventListener('click', handleSaveQuota);

    // ============ Fund Handling ============
    async function handleSaveFund() {
        const amount = parseFloat(fundAmountInput.value);

        if (isNaN(amount) || amount < 0) {
            showAlert('warning', 'Monto inválido', 'Ingresa un monto mayor o igual a 0.');
            return;
        }

        if (!fundConfirmInput.checked) {
            showAlert('warning', 'Falta confirmación', 'Marca la casilla para confirmar.');
            return;
        }

        saveFundBtn.disabled = true;

        try {
            const response = await fetch('/api/accounting/finance-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initial_amount: amount })
            });

            const result = await response.json();

            if (!result.success) {
                showAlert('error', 'Error al guardar', result.message || 'No se pudo guardar el fondo.');
                return;
            }

            await showAlert('success', 'Éxito', 'El fondo inicial se actualizó correctamente.', 1500);
            fundAmountInput.value = '';
            fundConfirmInput.checked = false;
            await loadFinanceConfig();
        } catch (error) {
            showAlert('error', 'Error de conexión', 'No se pudo guardar el fondo.');
            console.error('Fund save error:', error);
        } finally {
            saveFundBtn.disabled = false;
        }
    }

    // ============ Quota Handling ============
    function initializeQuotaForm() {
        const now = new Date();
        yearInput.value = now.getFullYear();
        monthInput.innerHTML = MONTHS
            .map((m, idx) => `<option value="${m}" ${idx === now.getMonth() ? 'selected' : ''}>${m}</option>`)
            .join('');
    }

    async function handleSaveQuota() {
        const month = String(monthInput.value || '').trim();
        const year = parseInt(yearInput.value, 10);
        const amount = parseFloat(amountInput.value);

        if (!month) {
            showAlert('warning', 'Falta mes', 'Selecciona el mes de la cuota.');
            return;
        }

        if (isNaN(year) || year < 2000) {
            showAlert('warning', 'Año inválido', 'Ingresa un año válido.');
            return;
        }

        if (isNaN(amount) || amount <= 0) {
            showAlert('warning', 'Monto inválido', 'Ingresa una cuota mayor a 0.');
            return;
        }

        if (!confirmInput.checked) {
            showAlert('warning', 'Falta confirmación', 'Marca la casilla para confirmar.');
            return;
        }

        saveQuotaBtn.disabled = true;

        try {
            const response = await fetch('/api/accounting/finance-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month, year, amount })
            });

            const result = await response.json();

            if (!result.success) {
                showAlert('error', 'Error al guardar', result.message || 'No se pudo guardar la cuota.');
                return;
            }

            await showAlert('success', 'Éxito', 'La cuota mensual se actualizó correctamente.', 1500);
            amountInput.value = '';
            confirmInput.checked = false;
            await loadFinanceConfig();
        } catch (error) {
            showAlert('error', 'Error de conexión', 'No se pudo guardar la cuota.');
            console.error('Quota save error:', error);
        } finally {
            saveQuotaBtn.disabled = false;
        }
    }

    // ============ Data Loading ============
    async function loadFinanceConfig() {
        try {
            const response = await fetch('/api/accounting/finance-config');
            const result = await response.json();

            if (!result.success) {
                setFundDisplay('$0.00', 'No se pudo consultar la configuración');
                setBalanceDisplay({ balance: 0, initialAmount: 0, totalPayments: 0, totalExpenses: 0 });
                setQuotasDisplay([]);
                return;
            }

            // Load fund data
            const fund = result.fund;
            if (fund) {
                setFundDisplay(formatCurrency(fund.initial_amount), `Última actualización: ${formatDateTime(fund.updated_at)}`);
            } else {
                setFundDisplay('$0.00', 'Sin actualizaciones registradas');
            }

            // Load balance data
            if (result.balance) {
                setBalanceDisplay(result.balance);
            }

            // Load quotas data
            const quotas = result.quotas || [];
            setQuotasDisplay(quotas);
        } catch (error) {
            setFundDisplay('$0.00', 'Error de red al consultar configuración');
            setBalanceDisplay({ balance: 0, initialAmount: 0, totalPayments: 0, totalExpenses: 0 });
            setQuotasDisplay([]);
            console.error('Load config error:', error);
        }
    }

    function setBalanceDisplay(balanceData) {
        currentBalanceText.textContent = formatCurrency(balanceData.balance);
        breakdownFundText.textContent = formatCurrency(balanceData.initialAmount);
        breakdownPaymentsText.textContent = `+${formatCurrency(balanceData.totalPayments)}`;
        breakdownExpensesText.textContent = `-${formatCurrency(balanceData.totalExpenses)}`;
    }

    function setFundDisplay(amount, date) {
        currentFundText.textContent = amount;
        updatedAtText.textContent = date;
    }

    function setQuotasDisplay(quotas) {
        if (!Array.isArray(quotas) || quotas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Sin cuotas configuradas</td></tr>';
            return;
        }

        tbody.innerHTML = quotas
            .map(q => `
                <tr>
                    <td>${escapeHtml(q.year)}</td>
                    <td>${escapeHtml(q.month)}</td>
                    <td>${escapeHtml(formatCurrency(q.amount))}</td>
                    <td>${escapeHtml(formatDateTime(q.created_at))}</td>
                </tr>
            `)
            .join('');
    }

    // ============ Utilities ============
    function formatCurrency(value) {
        const amount = Number(value || 0);
        return amount.toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function formatDateTime(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return 'Fecha inválida';
        }

        return date.toLocaleString('es-MX', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function showAlert(icon, title, message, timer = null) {
        const config = {
            icon,
            title,
            text: message,
            confirmButtonColor: icon === 'error' ? '#d33' : '#ED7A13',
            confirmButtonText: 'Aceptar'
        };

        if (timer) {
            config.timer = timer;
            config.timerProgressBar = true;
            config.showConfirmButton = false;
        }

        return Swal.fire(config);
    }
});
