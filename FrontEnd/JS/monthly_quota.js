/**
 * TESINA: Gestion de cuotas mensuales desde el cliente.
 * Responsabilidad: capturar cuota por mes/anio y mostrar historico.
 * Flujo: validar formulario -> enviar a API -> recargar tabla.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const monthInput = document.getElementById('quota-month');
    const yearInput = document.getElementById('quota-year');
    const amountInput = document.getElementById('quota-amount');
    const confirmInput = document.getElementById('quota-confirm');
    const saveBtn = document.getElementById('save-quota-btn');
    const tbody = document.getElementById('quota-tbody');

    const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const now = new Date();
    yearInput.value = now.getFullYear();
    monthInput.innerHTML = MONTHS.map((m, idx) => `<option value="${m}" ${idx === now.getMonth() ? 'selected' : ''}>${m}</option>`).join('');

    await withLock('monthly-quotas-load', async () => await loadQuotas());

    saveBtn.addEventListener('click', async () => await withButtonLock(saveBtn, async () => {
        const month = String(monthInput.value || '').trim();
        const year = parseInt(yearInput.value, 10);
        const amount = parseFloat(amountInput.value);

        if (!month) {
            Swal.fire({
                title: 'Falta mes',
                text: 'Selecciona el mes de la cuota.',
                icon: 'warning',
                confirmButtonColor: '#ED7A13',
                confirmButtonText: 'Aceptar'
            });
            return;
        }

        if (isNaN(year) || year < 2000) {
            Swal.fire({
                title: 'Año inválido',
                text: 'Ingresa un año válido.',
                icon: 'warning',
                confirmButtonColor: '#ED7A13',
                confirmButtonText: 'Aceptar'
            });
            return;
        }

        if (isNaN(amount) || amount <= 0) {
            Swal.fire({
                title: 'Monto inválido',
                text: 'Ingresa una cuota mayor a 0.',
                icon: 'warning',
                confirmButtonColor: '#ED7A13',
                confirmButtonText: 'Aceptar'
            });
            return;
        }

        if (!confirmInput.checked) {
            Swal.fire({
                title: 'Falta confirmación',
                text: 'Marca la casilla para confirmar.',
                icon: 'warning',
                confirmButtonColor: '#ED7A13',
                confirmButtonText: 'Aceptar'
            });
            return;
        }

        try {
            const response = await fetch('/api/accounting/monthly-quota', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month, year, amount })
            });

            const result = await response.json();
            if (!result.success) {
                Swal.fire({
                    title: 'Error al guardar',
                    text: result.message || 'No se pudo guardar la cuota.',
                    icon: 'error',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Aceptar'
                });
                return;
            }

            await Swal.fire({
                icon: 'success',
                title: 'Cuota guardada',
                text: 'La cuota mensual se actualizo correctamente.',
                timer: 1500,
                timerProgressBar: true,
                showConfirmButton: false
            });

            amountInput.value = '';
            confirmInput.checked = false;
            await loadQuotas();
        } catch (error) {
            Swal.fire({
                title: 'Error de conexión',
                text: 'No se pudo guardar la cuota.',
                icon: 'error',
                confirmButtonColor: '#d33',
                confirmButtonText: 'Aceptar'
            });
        } finally {
            // button state restored by withButtonLock
        }
    }, { loadingText: 'GUARDANDO...' }));

    // Consulta configuraciones guardadas y renderiza el histórico en tabla.
    async function loadQuotas() {
        try {
            const response = await fetch('/api/accounting/monthly-quota');
            const result = await response.json();

            if (!result.success) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Error al cargar cuotas</td></tr>';
                return;
            }

            const quotas = result.quotas || [];
            if (!quotas.length) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Sin cuotas configuradas</td></tr>';
                return;
            }

            tbody.innerHTML = quotas.map(q => `
                <tr>
                    <td>${escapeHtml(q.year)}</td>
                    <td>${escapeHtml(q.month)}</td>
                    <td>${escapeHtml(formatCurrency(q.amount))}</td>
                    <td>${escapeHtml(formatDateTime(q.created_at))}</td>
                </tr>
            `).join('');
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Error de red</td></tr>';
        }
    }

    // Formatea montos monetarios en convencion local MXN.
    function formatCurrency(value) {
        const amount = Number(value || 0);
        return amount.toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // Convierte timestamp en fecha y hora legibles para bitacora.
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

    // Escapa contenido textual antes de pintarlo en HTML.
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});
