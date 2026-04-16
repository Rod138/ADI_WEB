/**
 * TESINA: Administracion del fondo de torre en cliente.
 * Responsabilidad: consultar saldo actual y actualizar monto configurado.
 * Flujo: cargar saldo inicial -> validar captura -> persistir cambio.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const currentFundText = document.getElementById('current-fund');
    const updatedAtText = document.getElementById('updated-at');
    const amountInput = document.getElementById('fund-amount');
    const confirmInput = document.getElementById('fund-confirm');
    const saveBtn = document.getElementById('save-fund-btn');

    await loadCurrentFund();

    saveBtn.addEventListener('click', async () => {
        const amount = parseFloat(amountInput.value);

        if (isNaN(amount) || amount < 0) {
            Swal.fire({ icon: 'warning', title: 'Monto invalido', text: 'Ingresa un monto mayor o igual a 0.' });
            return;
        }

        if (!confirmInput.checked) {
            Swal.fire({ icon: 'warning', title: 'Falta confirmacion', text: 'Marca la casilla para confirmar.' });
            return;
        }

        saveBtn.disabled = true;

        try {
            const response = await fetch('/api/accounting/tower-fund', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initial_amount: amount })
            });

            const result = await response.json();
            if (!result.success) {
                Swal.fire({ icon: 'error', title: 'Error', text: result.message || 'No se pudo guardar el fondo inicial.' });
                return;
            }

            await Swal.fire({
                icon: 'success',
                title: 'Fondo actualizado',
                text: 'El fondo inicial se guardo correctamente.',
                timer: 1500,
                timerProgressBar: true,
                showConfirmButton: false
            });

            amountInput.value = '';
            confirmInput.checked = false;
            await loadCurrentFund();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Fallo de red al guardar.' });
        } finally {
            saveBtn.disabled = false;
        }
    });

    // Recupera el saldo vigente del fondo inicial y actualiza indicadores visuales.
    async function loadCurrentFund() {
        try {
            const response = await fetch('/api/accounting/tower-fund');
            const result = await response.json();

            if (!result.success) {
                currentFundText.textContent = '$0.00';
                updatedAtText.textContent = 'No se pudo consultar el fondo actual';
                return;
            }

            const fund = result.fund;
            if (!fund) {
                currentFundText.textContent = '$0.00';
                updatedAtText.textContent = 'Sin actualizaciones registradas';
                return;
            }

            currentFundText.textContent = formatCurrency(fund.initial_amount);
            updatedAtText.textContent = `Ultima actualizacion: ${formatDateTime(fund.updated_at)}`;
        } catch (error) {
            currentFundText.textContent = '$0.00';
            updatedAtText.textContent = 'Error de red al consultar el fondo actual';
        }
    }

    // Presenta cantidad como moneda con formato local.
    function formatCurrency(value) {
        const amount = Number(value || 0);
        return amount.toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // Traduce fecha de actualizacion a formato de lectura administrativa.
    function formatDateTime(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return 'Fecha invalida';
        }

        return date.toLocaleString('es-MX', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
});
