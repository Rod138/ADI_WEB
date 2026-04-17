/**
 * TESINA: Vista detalle de comprobante de pago.
 * Responsabilidad: cargar comprobante por id y permitir validacion por rol.
 * Regla: solo roles con permisos administrativos pueden validar.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const card = document.getElementById('receipt-card');
    const params = new URLSearchParams(window.location.search);
    const receiptId = params.get('id');
    const sessionUser = JSON.parse(sessionStorage.getItem('user') || '{}');
    const canValidate = Number(sessionUser.rol_id) >= 2;

    if (!receiptId) {
        card.innerHTML = '<p class="error">No se especifico comprobante.</p>';
        return;
    }

    try {
        const response = await fetch(`/api/accounting/receipts/${encodeURIComponent(receiptId)}`);
        const data = await response.json();

        if (!data.success) {
            card.innerHTML = '<p class="error">No se pudo cargar el comprobante.</p>';
            return;
        }

        const receipt = data.receipt;
        const dateText = receipt.created_at
            ? new Date(receipt.created_at).toLocaleString('es-MX', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })
            : '-';

        const amountPaid = receipt.amount_paid !== null && receipt.amount_paid !== undefined
            ? `$${parseFloat(receipt.amount_paid).toFixed(2)}`
            : '-';

        const observation = `Mes ${receipt.month || '-'} ${receipt.year || '-'} | Departamento ${receipt.department_name || `DEP ${receipt.dep_id}`}`;
        const imageUrl = String(receipt.url_image || '').trim();
        const hasImage = imageUrl && imageUrl.toLowerCase() !== 'null';
        const imageMarkup = hasImage
            ? `<img src="${escapeHtml(imageUrl)}" alt="Comprobante">`
            : '<span class="material-symbols-outlined">image</span>';

        card.innerHTML = `
            <div class="form-grid">
                <label>TIPO :</label>
                <input type="text" value="Comprobante de cuota" readonly>

                <label>FECHA :</label>
                <input type="text" value="${escapeHtml(dateText)}" readonly>

                <label>COSTO :</label>
                <input type="text" value="${amountPaid}" readonly>

                <div class="obs-row">
                    <label>OBSERVACIONES</label>
                    <span>${observation.length} / 150</span>
                </div>
                <input type="text" value="${escapeHtml(observation)}" readonly>

                <div class="image-box">
                    ${imageMarkup}
                </div>

                ${canValidate ? `
                <label class="checkbox-label">
                    <input type="checkbox" id="validated-check" ${receipt.validated ? 'checked' : ''}>
                    MARCAR COMPROBANTE COMO VALIDADO
                </label>
                <button id="save-validate-btn" class="btn-upload">GUARDAR</button>
                ` : `
                <label class="checkbox-label disabled-label">
                    <input type="checkbox" disabled ${receipt.validated ? 'checked' : ''}>
                    ${receipt.validated ? 'COMPROBANTE VALIDADO' : 'COMPROBANTE PENDIENTE'}
                </label>
                `}
            </div>
        `;

        if (canValidate) {
            const saveBtn = document.getElementById('save-validate-btn');
            const check = document.getElementById('validated-check');

            saveBtn.addEventListener('click', async () => {
                saveBtn.disabled = true;
                try {
                    const patchRes = await fetch(`/api/accounting/receipts/${encodeURIComponent(receiptId)}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ validated: check.checked })
                    });

                    const patchData = await patchRes.json();
                    if (!patchData.success) {
                        Swal.fire({
                            title: 'Error al actualizar',
                            text: patchData.message || 'No se pudo actualizar.',
                            icon: 'error',
                            confirmButtonColor: '#d33',
                            confirmButtonText: 'Aceptar'
                        });
                        return;
                    }

                    await Swal.fire({
                        title: 'Comprobante actualizado',
                        text: check.checked ? 'El comprobante quedó validado.' : 'El comprobante quedó marcado como no validado.',
                        icon: 'success',
                        timer: 1600,
                        timerProgressBar: true,
                        showConfirmButton: false,
                        confirmButtonColor: '#6A8042'
                    });
                } catch (error) {
                    Swal.fire({
                        title: 'Error de conexión',
                        text: 'Fallo de red.',
                        icon: 'error',
                        confirmButtonColor: '#d33',
                        confirmButtonText: 'Aceptar'
                    });
                } finally {
                    saveBtn.disabled = false;
                }
            });
        }
    } catch (error) {
        card.innerHTML = '<p class="error">Error al cargar el comprobante.</p>';
    }

    // Escapa contenido dinamico antes de inyectarlo en el template de detalle.
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});
