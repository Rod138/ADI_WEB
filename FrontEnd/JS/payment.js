/**
 * TESINA: Tablon de "Mis cuotas" para residentes.
 * Responsabilidad: registrar pago con comprobante y listar historial propio.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const user = window.ADIAuth?.getCurrentUser?.();
    const monthInput = document.getElementById('pay-month');
    const amountPaidInput = document.getElementById('pay-amount');
    const amountExpectedInput = document.getElementById('pay-expected');
    const yearInput = document.getElementById('pay-year');
    const proofInput = document.getElementById('pay-proof');
    const saveBtn = document.getElementById('save-payment-btn');

    const fltStatus = document.getElementById('flt-status');
    const fltMonth = document.getElementById('flt-month');
    const fltYear = document.getElementById('flt-year');
    const tbody = document.getElementById('payments-tbody');

    const paginationBox = document.getElementById('payments-pagination');
    const prevBtn = document.getElementById('pay-prev-btn');
    const nextBtn = document.getElementById('pay-next-btn');
    const pageIndicator = document.getElementById('pay-page-indicator');
    const downloadBtn = document.getElementById('download-btn');

    const CLOUDINARY_CLOUD_NAME = document.body.dataset.cloudinaryCloudName || '';
    const CLOUDINARY_UPLOAD_PRESET = document.body.dataset.cloudinaryUploadPreset || '';
    const CLOUDINARY_IMAGE_UPLOAD_URL = CLOUDINARY_CLOUD_NAME
        ? `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`
        : '';
    const CLOUDINARY_RAW_UPLOAD_URL = CLOUDINARY_CLOUD_NAME
        ? `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`
        : '';

    const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const PAGE_SIZE = 10;

    let currentPage = 1;
    let allRows = [];
    let filteredRows = [];
    let quotas = [];

    const now = new Date();
    yearInput.value = now.getFullYear();
    monthInput.innerHTML = MONTHS.map((m, idx) => `<option value="${m}" ${idx === now.getMonth() ? 'selected' : ''}>${m}</option>`).join('');
    fltMonth.innerHTML += MONTHS.map(m => `<option value="${m}">${m}</option>`).join('');

    await refreshData();

    monthInput.addEventListener('change', autoFillExpectedAmount);
    yearInput.addEventListener('input', autoFillExpectedAmount);

    fltStatus.addEventListener('change', applyFilters);
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

    downloadBtn.addEventListener('click', downloadCsv);

    tbody.addEventListener('click', (event) => {
        const proofButton = event.target.closest('.proof-link');
        if (!proofButton) return;

        const proofUrl = proofButton.dataset.proof || '';
        const proofType = proofButton.dataset.proofType || 'image';
        openProofPreview(proofUrl, proofType);
    });

    proofInput.addEventListener('change', () => {
        const proofName = document.getElementById('proof-name');
        const proofUploadBox = proofInput.closest('.proof-upload-box');
        if (proofInput.files?.length > 0) {
            proofName.textContent = proofInput.files[0].name;
            proofUploadBox?.classList.add('is-filled');
        } else {
            proofName.textContent = 'Selecciona archivo';
            proofUploadBox?.classList.remove('is-filled');
        }
    });

    saveBtn.addEventListener('click', async () => {
        const month = monthInput.value;
        const year = parseInt(yearInput.value, 10);
        const amountPaid = parseFloat(amountPaidInput.value);
        const amountExpected = parseFloat(amountExpectedInput.value);
        const proofFile = proofInput.files?.[0];

        if (!month) {
            return notify('Mes faltante', 'Selecciona el mes correspondiente.', 'warning');
        }

        if (isNaN(year) || year < 2000) {
            return notify('Ano invalido', 'Ingresa un ano valido (desde 2000).', 'warning');
        }

        if (isNaN(amountPaid) || amountPaid < 0) {
            return notify('Cantidad invalida', 'Ingresa una cantidad pagada valida.', 'warning');
        }

        if (isNaN(amountExpected) || amountExpected <= 0) {
            return notify('Cantidad esperada invalida', 'Ingresa la cuota esperada.', 'warning');
        }

        if (!proofFile) {
            return notify('Comprobante faltante', 'Debes adjuntar una imagen o PDF.', 'warning');
        }

        if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
            return notify('Cloudinary no configurado', 'Falta configuracion de Cloudinary en el servidor.', 'error');
        }

        saveBtn.disabled = true;

        try {
            const proofUrl = await uploadProofToCloudinary(proofFile);

            const r = await fetch('/api/accounting/payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dep_id: user?.dep_id,
                    year,
                    month,
                    amount_paid: amountPaid,
                    amount_expected: amountExpected,
                    url_image: proofUrl
                })
            });

            const result = await r.json();
            if (!result.success) {
                notify('Error al guardar', result.message || 'No se pudo guardar el pago.', 'error');
                return;
            }

            await notify('Pago enviado', 'Tu comprobante quedo registrado y pendiente de validacion.', 'success', 1800);

            amountPaidInput.value = '';
            proofInput.value = '';
            proofInput.closest('.proof-upload-box')?.classList.remove('is-filled');
            document.getElementById('proof-name').textContent = 'Selecciona un archivo';
            await refreshData();
        } catch (error) {
            notify('Error de conexion', error.message || 'No se pudo registrar el pago.', 'error');
        } finally {
            saveBtn.disabled = false;
        }
    });

    async function refreshData() {
        try {
            const res = await fetch('/api/accounting/payment-data');
            const data = await res.json();

            if (!data.success) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Error al cargar datos</td></tr>';
                return;
            }

            quotas = data.quotas || [];

            const baseRows = data.receipts || [];
            allRows = Number(user?.dep_id)
                ? baseRows.filter(r => Number(r.dep_id) === Number(user.dep_id))
                : baseRows;

            const uniqueYears = [...new Set(allRows.map(r => r.year).filter(Boolean))].sort((a, b) => b - a);
            fltYear.innerHTML = '<option value="any">Cualquiera</option>' + uniqueYears.map(y => `<option value="${y}">${y}</option>`).join('');

            autoFillExpectedAmount();
            applyFilters();
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Error de red</td></tr>';
        }
    }

    function autoFillExpectedAmount() {
        const month = String(monthInput.value || '').toLowerCase();
        const year = parseInt(yearInput.value, 10);
        const quota = quotas.find(q => String(q.month || '').toLowerCase() === month && Number(q.year) === year);
        amountExpectedInput.value = (quota && quota.amount !== null && quota.amount !== undefined)
            ? Number(quota.amount).toFixed(2)
            : '';
    }

    function applyFilters() {
        let rows = [...allRows];

        if (fltMonth.value !== 'any') {
            rows = rows.filter(r => String(r.month) === String(fltMonth.value));
        }

        if (fltYear.value !== 'any') {
            rows = rows.filter(r => String(r.year) === String(fltYear.value));
        }

        if (fltStatus.value !== 'any') {
            rows = rows.filter(r => statusKey(r.validated) === fltStatus.value);
        }

        rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        filteredRows = rows;
        currentPage = 1;
        renderTable(filteredRows);
    }

    function renderTable(rows) {
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Sin pagos registrados</td></tr>';
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

        tbody.innerHTML = items.map(r => {
            const status = buildStatusBadge(r.validated);
            const createdAt = r.created_at ? new Date(r.created_at).toLocaleString('es-MX') : '-';
            const period = `${escapeHtml(r.month || '-')} ${escapeHtml(r.year || '-')}`;
            const paid = formatCurrency(r.amount_paid);
            const expected = formatCurrency(r.amount_expected);
            const proof = r.url_image
                ? `<button type="button" class="proof-link" data-proof="${escapeHtml(r.url_image)}" data-proof-type="${getProofType(r.url_image)}">Ver</button>`
                : '<span>-</span>';

            return `
                <tr>
                    <td class="cell-status">${status}</td>
                    <td>${createdAt}</td>
                    <td>${period}</td>
                    <td>${paid}</td>
                    <td>${expected}</td>
                    <td class="cell-proof">${proof}</td>
                </tr>
            `;
        }).join('');
    }

    function buildStatusBadge(validated) {
        if (validated === true) {
            return '<span class="status-badge status-validado">VALIDADO</span>';
        }
        if (validated === false) {
            return '<span class="status-badge status-rechazado">RECHAZADO</span>';
        }
        return '<span class="status-badge status-pendiente">PENDIENTE</span>';
    }

    function getProofType(url) {
        const normalized = String(url || '').toLowerCase();
        return normalized.includes('.pdf') ? 'pdf' : 'image';
    }

    function openProofPreview(proofUrl, proofType) {
        if (!proofUrl) return;

        if (proofType === 'pdf') {
            Swal.fire({
                title: 'Comprobante PDF',
                html: `
                    <div style="display:flex;flex-direction:column;gap:0.75rem;align-items:center">
                        <p style="margin:0;color:#444">El comprobante es un PDF. Puedes abrirlo en una pestaña nueva.</p>
                        <a href="${escapeHtml(proofUrl)}" target="_blank" rel="noopener noreferrer" class="btn-back" style="display:inline-flex;align-items:center;justify-content:center;text-decoration:none;min-width:11rem">Abrir comprobante</a>
                    </div>
                `,
                confirmButtonText: 'Cerrar',
                confirmButtonColor: '#6A8042'
            });
            return;
        }

        Swal.fire({
            title: 'Comprobante',
            imageUrl: proofUrl,
            imageAlt: 'Comprobante de pago',
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#6A8042',
            width: 'min(92vw, 62.5rem)'
        });
    }

    function statusKey(validated) {
        if (validated === true) return 'approved';
        if (validated === false) return 'rejected';
        return 'pending';
    }

    async function uploadProofToCloudinary(file) {
        const filename = file.name || 'comprobante';
        const extension = filename.split('.').pop()?.toLowerCase() || '';
        const isPdf = extension === 'pdf' || file.type === 'application/pdf';
        const uploadUrl = isPdf ? CLOUDINARY_RAW_UPLOAD_URL : CLOUDINARY_IMAGE_UPLOAD_URL;

        const formData = new FormData();
        formData.append('file', file, filename);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        formData.append('folder', 'cuotas');

        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok || !data?.secure_url) {
            throw new Error(data?.error?.message || 'No se pudo subir el comprobante.');
        }

        return data.secure_url;
    }

    function downloadCsv() {
        const rows = (filteredRows.length ? filteredRows : allRows).slice();
        const header = ['Estado', 'Fecha', 'Mes', 'Ano', 'Monto pagado', 'Monto esperado', 'Comprobante'];
        const body = rows.map(r => [
            statusKey(r.validated),
            r.created_at || '',
            r.month || '',
            r.year || '',
            r.amount_paid || '',
            r.amount_expected || '',
            r.url_image || ''
        ]);

        const csv = [header, ...body]
            .map(cols => cols.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'mis_cuotas.csv';
        link.click();
        URL.revokeObjectURL(url);
    }

    function notify(title, text, icon, timer = 2200) {
        return Swal.fire({
            title,
            text,
            icon,
            confirmButtonText: 'OK',
            confirmButtonColor: icon === 'error' ? '#d33' : '#ED7A13',
            showConfirmButton: true,
            timer,
            timerProgressBar: true
        });
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
});
