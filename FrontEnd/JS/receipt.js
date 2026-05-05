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

        const isValidated = Number(receipt.validated) === 2 || receipt.validated === true;
        const statusText = isValidated ? 'Completado' : 'Pendiente';
        const statusClass = isValidated ? 'status-completado' : 'status-pendiente';

        const amountPaid = receipt.amount_paid !== null && receipt.amount_paid !== undefined
            ? `$${parseFloat(receipt.amount_paid).toFixed(2)}`
            : '-';

        const observation = `Mes ${receipt.month || '-'} ${receipt.year || '-'} | Departamento ${receipt.department_name || `DEP ${receipt.dep_id}`}`;
        const imageUrl = String(receipt.url_image || '').trim();
        const hasImage = imageUrl && imageUrl.toLowerCase() !== 'null';
        const imageMarkup = hasImage
            ? `<img src="${escapeHtml(imageUrl)}" alt="Comprobante" class="receipt-image" title="Clic para ampliar">`
            : '<span class="material-symbols-outlined">image</span>';

        card.innerHTML = `
            <div class="receipt-detail-shell">
                <header class="receipt-detail-header">
                    <div>
                        <p class="detail-overline">Comprobante #${escapeHtml(receiptId)}</p>
                        <h2>Revision de pago</h2>
                    </div>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </header>

                <section class="detail-grid">
                    <div class="detail-field">
                        <label>Tipo</label>
                        <input type="text" value="Comprobante de cuota" readonly>
                    </div>
                    <div class="detail-field">
                        <label>Fecha</label>
                        <input type="text" value="${escapeHtml(dateText)}" readonly>
                    </div>
                    <div class="detail-field">
                        <label>Monto pagado</label>
                        <input type="text" value="${amountPaid}" readonly>
                    </div>
                    <div class="detail-field">
                        <label>Departamento</label>
                        <input type="text" value="${escapeHtml(receipt.department_name || `DEP ${receipt.dep_id}`)}" readonly>
                    </div>
                </section>

                <div class="detail-field detail-field-full">
                    <div class="obs-row">
                        <label>Observaciones</label>
                        <span>${observation.length} / 150</span>
                    </div>
                    <input type="text" value="${escapeHtml(observation)}" readonly>
                </div>

                <div class="image-area">
                    <p class="image-label">Comprobante (clic para ampliar)</p>
                    <div class="image-box ${hasImage ? 'has-image' : ''}">
                        ${imageMarkup}
                    </div>
                </div>

                ${canValidate ? `
                <div class="validation-actions">
                    <label class="checkbox-label">
                        <input type="checkbox" id="validated-check" ${isValidated ? 'checked' : ''}>
                        Marcar comprobante como validado
                    </label>
                    <button id="save-validate-btn" class="btn-upload">Guardar</button>
                </div>
                ` : `
                <div class="validation-actions readonly-actions">
                    <label class="checkbox-label disabled-label">
                        <input type="checkbox" disabled ${isValidated ? 'checked' : ''}>
                        ${isValidated ? 'Comprobante validado' : 'Comprobante pendiente'}
                    </label>
                </div>
                `}
            </div>
        `;

        if (hasImage) {
            const imageElement = card.querySelector('.receipt-image');
            if (imageElement) {
                imageElement.addEventListener('click', () => {
                    Swal.fire({
                        title: 'Comprobante',
                        imageUrl,
                        imageAlt: 'Comprobante de pago',
                        confirmButtonText: 'Cerrar',
                        confirmButtonColor: '#6A8042',
                        width: 'min(92vw, 62.5rem)'
                    });
                });
            }
        }

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
