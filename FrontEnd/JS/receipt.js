/**
 * TESINA: Vista detalle de comprobante de pago.
 * Responsabilidad: cargar comprobante por id y permitir validación por rol.
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

        function receiptStatus(value) {
            if (value === true) return 'approved';
            if (value === false) return 'rejected';
            if (value === null || value === undefined) return 'pending';
            if (Number(value) === 2) return 'approved';
            if (Number(value) === 1) return 'rejected';
            return 'pending';
        }

        const status = receiptStatus(receipt.validated);
        let statusText = 'Pendiente';
        let statusClass = 'status-pendiente';
        if (status === 'approved') {
            statusText = 'Validado';
            statusClass = 'status-completado';
        } else if (status === 'rejected') {
            statusText = 'Rechazado';
            statusClass = 'status-rechazado';
        }

        const amountPaid = receipt.amount_paid !== null && receipt.amount_paid !== undefined
            ? `$${parseFloat(receipt.amount_paid).toFixed(2)}`
            : '-';

        const observation = `Mes ${receipt.month || '-'} ${receipt.year || '-'} | Departamento ${receipt.department_name || `DEP ${receipt.dep_id}`}`;
        const imageUrl = String(receipt.url_image || '').trim();
        const hasImage = imageUrl && imageUrl.toLowerCase() !== 'null';
        const isPdf = hasImage && imageUrl.toLowerCase().endsWith('.pdf');
        const imageMarkup = hasImage
            ? (isPdf
                ? `<a href="${escapeHtml(imageUrl)}" class="pdf-link" title="Ver PDF" aria-label="Ver PDF"><span class="material-symbols-outlined">picture_as_pdf</span></a>`
                : `<img src="${escapeHtml(imageUrl)}" alt="Comprobante" class="receipt-image" title="Clic para ampliar">`)
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
                    <button id="approve-btn" class="btn-upload">Aprobar</button>
                    <button id="reject-btn" class="btn-upload" style="background:#842029;color:#fff;margin-left:0.5rem">Rechazar</button>
                </div>
                ` : `
                <div class="validation-actions readonly-actions">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                `}
            </div>
        `;

        if (hasImage) {
            if (isPdf) {
                // Abrir PDF embebido en modal
                const pdfLink = card.querySelector('.pdf-link');
                const pdfBox = card.querySelector('.pdf-preview');
                const openPdf = (e) => {
                    if (e) e.preventDefault();
                    Swal.fire({
                        title: 'Comprobante (PDF)',
                        html: `
                            <div style="width:100%;height:70vh;">
                                <iframe src="${escapeHtml(imageUrl)}" style="width:100%;height:100%;border:0" frameborder="0"></iframe>
                            </div>
                        `,
                        showConfirmButton: true,
                        confirmButtonText: 'Cerrar',
                        confirmButtonColor: '#6A8042',
                        width: 'min(92vw, 92vw)'
                    });
                };

                if (pdfLink) pdfLink.addEventListener('click', openPdf);
                if (pdfBox) pdfBox.addEventListener('click', openPdf);
            } else {
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
        }

        if (canValidate) {
            const approveBtn = document.getElementById('approve-btn');
            const rejectBtn = document.getElementById('reject-btn');

            approveBtn.addEventListener('click', async () => {
                await withButtonLock(approveBtn, async () => {
                    const patchRes = await fetch(`/api/accounting/receipts/${encodeURIComponent(receiptId)}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ validated: true })
                    });
                    const patchData = await patchRes.json();
                    if (!patchData.success) {
                        return Swal.fire('Error', patchData.message || 'No se pudo actualizar.', 'error');
                    }
                    await Swal.fire({ title: 'Comprobante validado', icon: 'success', timer: 1200, showConfirmButton: false });
                    window.location.reload();
                }, { loadingText: 'APROBANDO...' });
            });

            rejectBtn.addEventListener('click', async () => {
                const confirm = await Swal.fire({
                    title: 'Confirmar rechazo',
                    text: '¿Deseas marcar este comprobante como rechazado?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, rechazar',
                    cancelButtonText: 'Cancelar',
                    confirmButtonColor: '#842029'
                });
                if (!confirm.isConfirmed) return;

                await withButtonLock(rejectBtn, async () => {
                    const patchRes = await fetch(`/api/accounting/receipts/${encodeURIComponent(receiptId)}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ validated: false })
                    });
                    const patchData = await patchRes.json();
                    if (!patchData.success) {
                        return Swal.fire('Error', patchData.message || 'No se pudo actualizar.', 'error');
                    }
                    await Swal.fire({ title: 'Comprobante rechazado', icon: 'success', timer: 1200, showConfirmButton: false });
                    window.location.reload();
                }, { loadingText: 'RECHAZANDO...' });
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
