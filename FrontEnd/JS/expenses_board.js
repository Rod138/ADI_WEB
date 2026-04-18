/**
 * TESINA: Tablon de gastos de condominio.
 * Responsabilidad: listar gastos, aplicar filtros y paginar resultados.
 * Flujo: obtener gastos -> filtrar/ordenar -> renderizar tabla.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('expenses-tbody');
    const monthSelect = document.getElementById('month-filter');
    const amountSelect = document.getElementById('amount-filter');
    const orderSelect = document.getElementById('order-by');
    const paginationBox = document.getElementById('expenses-pagination');
    const prevBtn = document.getElementById('exp-prev-btn');
    const nextBtn = document.getElementById('exp-next-btn');
    const pageIndicator = document.getElementById('exp-page-indicator');

    // Elementos del formulario integrado
    const openFormBtn = document.getElementById('open-expense-form-btn');
    const closeFormBtn = document.getElementById('close-expense-form-btn');
    const expenseFormPanel = document.getElementById('expense-form-panel');
    const cancelExpenseBtn = document.getElementById('cancel-expense-btn');
    const amountInput = document.getElementById('expense-amount');
    const notesInput = document.getElementById('expense-notes');
    const imageInput = document.getElementById('expense-image');
    const confirmInput = document.getElementById('expense-confirm');
    const saveBtn = document.getElementById('save-expense-btn');
    const charCounter = document.getElementById('char-counter');
    const uploadIcon = document.getElementById('upload-icon');
    const uploadName = document.getElementById('upload-name');
    const previewImage = document.getElementById('preview-image');

    const CLOUDINARY_CLOUD_NAME = document.body.dataset.cloudinaryCloudName || '';
    const CLOUDINARY_UPLOAD_PRESET = document.body.dataset.cloudinaryUploadPreset || '';
    const CLOUDINARY_IMAGE_UPLOAD_URL = CLOUDINARY_CLOUD_NAME
        ? `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`
        : '';

    let allExpenses = [];
    let filteredExpenses = [];
    const PAGE_SIZE = 10;
    let currentPage = 1;
    let imageData = '';

    try {
        const response = await fetch('/api/accounting/expenses-board');
        const data = await response.json();

        if (!data.success) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Error al cargar gastos</td></tr>';
            return;
        }

        allExpenses = data.expenses || [];
        populateMonthFilter(allExpenses);
        applyFilters();
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Error al cargar gastos</td></tr>';
        return;
    }

    // Event listeners para filtros
    monthSelect.addEventListener('change', applyFilters);
    amountSelect.addEventListener('change', applyFilters);
    orderSelect.addEventListener('change', applyFilters);

    // Event listeners para paginación
    prevBtn.addEventListener('click', () => {
        if (currentPage <= 1) return;
        currentPage -= 1;
        renderTable(filteredExpenses);
    });

    nextBtn.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / PAGE_SIZE));
        if (currentPage >= totalPages) return;
        currentPage += 1;
        renderTable(filteredExpenses);
    });

    // Event listeners para visualizar comprobantes
    tbody.addEventListener('click', (e) => {
        const trigger = e.target.closest('.receipt-thumb-btn');
        if (!trigger) return;
        const imgUrl = trigger.dataset.image;
        if (!imgUrl) {
            Swal.fire({
                title: 'Sin comprobante',
                text: 'Este gasto no incluye imagen.',
                icon: 'info',
                confirmButtonColor: '#ED7A13',
                confirmButtonText: 'Aceptar'
            });
            return;
        }

        Swal.fire({
            title: 'Comprobante de gasto',
            imageUrl: imgUrl,
            imageAlt: 'Comprobante',
            confirmButtonColor: '#6A8042',
            confirmButtonText: 'Cerrar'
        });
    });

    // Event listeners para formulario integrado
    openFormBtn.addEventListener('click', () => {
        expenseFormPanel.style.display = 'block';
        expenseFormPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    closeFormBtn.addEventListener('click', closeExpenseForm);
    cancelExpenseBtn.addEventListener('click', closeExpenseForm);

    notesInput.addEventListener('input', () => {
        charCounter.textContent = `${notesInput.value.length} / 150`;
    });

    imageInput.addEventListener('change', () => {
        const file = imageInput.files && imageInput.files[0];
        if (!file) {
            imageData = '';
            previewImage.style.display = 'none';
            uploadIcon.style.display = 'block';
            uploadName.textContent = 'Selecciona un comprobante';
            return;
        }

        if (!file.type.startsWith('image/')) {
            Swal.fire({
                title: 'Archivo inválido',
                text: 'Solo se permiten imágenes (JPG, PNG, GIF, WebP).',
                icon: 'error',
                confirmButtonColor: '#d33',
                confirmButtonText: 'Aceptar'
            });
            imageInput.value = '';
            imageData = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            imageData = String(reader.result || '');
            previewImage.style.display = 'none';
            uploadIcon.style.display = 'block';
            uploadName.textContent = file.name;
        };
        reader.readAsDataURL(file);
    });

    saveBtn.addEventListener('click', async () => {
        const amount = amountInput.value;
        const description = notesInput.value.trim();

        if (!amount || parseFloat(amount) <= 0) {
            Swal.fire({
                title: 'Costo inválido',
                text: 'Ingresa un costo mayor a 0.',
                icon: 'warning',
                confirmButtonColor: '#ED7A13',
                confirmButtonText: 'Aceptar'
            });
            return;
        }

        if (!description) {
            Swal.fire({
                title: 'Falta descripción',
                text: 'Escribe una descripción del gasto.',
                icon: 'warning',
                confirmButtonColor: '#ED7A13',
                confirmButtonText: 'Aceptar'
            });
            return;
        }

        if (!imageData) {
            Swal.fire({
                title: 'Falta comprobante',
                text: 'Selecciona la imagen del comprobante.',
                icon: 'warning',
                confirmButtonColor: '#ED7A13',
                confirmButtonText: 'Aceptar'
            });
            return;
        }

        if (!confirmInput.checked) {
            Swal.fire({
                title: 'Confirma el envío',
                text: 'Marca la casilla de confirmación.',
                icon: 'warning',
                confirmButtonColor: '#ED7A13',
                confirmButtonText: 'Aceptar'
            });
            return;
        }

        saveBtn.disabled = true;

        try {
            const response = await fetch('/api/accounting/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    description,
                    image_data: imageData,
                    expense_date: new Date().toISOString()
                })
            });

            const result = await response.json();

            if (!result.success) {
                Swal.fire({
                    title: 'Error al guardar',
                    text: result.message || 'No se pudo registrar el gasto.',
                    icon: 'error',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Aceptar'
                });
                return;
            }

            await Swal.fire({
                title: 'Gasto registrado',
                text: 'El gasto se guardó correctamente.',
                icon: 'success',
                timer: 1700,
                timerProgressBar: true,
                showConfirmButton: false,
                confirmButtonColor: '#6A8042'
            });

            resetExpenseForm();
            expenseFormPanel.style.display = 'none';

            // Recargar lista de gastos
            try {
                const response = await fetch('/api/accounting/expenses-board');
                const data = await response.json();
                if (data.success) {
                    allExpenses = data.expenses || [];
                    populateMonthFilter(allExpenses);
                    applyFilters();
                }
            } catch (e) {
                console.error('Error reloading expenses:', e);
            }
        } catch {
            Swal.fire({
                title: 'Error de conexión',
                text: 'No se pudo guardar el gasto.',
                icon: 'error',
                confirmButtonColor: '#d33',
                confirmButtonText: 'Aceptar'
            });
        } finally {
            saveBtn.disabled = false;
        }
    });

    function resetExpenseForm() {
        amountInput.value = '';
        notesInput.value = '';
        imageInput.value = '';
        confirmInput.checked = false;
        charCounter.textContent = '0 / 150';
        uploadIcon.style.display = 'block';
        uploadName.textContent = 'Selecciona un comprobante';
        previewImage.style.display = 'none';
        previewImage.removeAttribute('src');
        imageData = '';
    }

    function closeExpenseForm() {
        resetExpenseForm();
        expenseFormPanel.style.display = 'none';
    }

    // Llena periodos unicos para filtrar por mes y anio del gasto.
    function populateMonthFilter(expenses) {
        const uniquePeriods = [...new Set(
            expenses
                .filter(exp => exp.expense_date)
                .map(exp => formatMonthYear(exp.expense_date))
        )];

        uniquePeriods.forEach(period => {
            const option = document.createElement('option');
            option.value = period;
            option.textContent = period;
            monthSelect.appendChild(option);
        });
    }

    // Aplica filtros por periodo, rango de monto y criterio de orden.
    function applyFilters() {
        let filtered = [...allExpenses];

        const period = monthSelect.value;
        if (period !== 'any') {
            filtered = filtered.filter(exp => formatMonthYear(exp.expense_date) === period);
        }

        const amountRange = amountSelect.value;
        if (amountRange === 'lt-500') {
            filtered = filtered.filter(exp => Number(exp.amount) < 500);
        }
        if (amountRange === '500-1000') {
            filtered = filtered.filter(exp => Number(exp.amount) >= 500 && Number(exp.amount) <= 1000);
        }
        if (amountRange === 'gt-1000') {
            filtered = filtered.filter(exp => Number(exp.amount) > 1000);
        }

        const orderBy = orderSelect.value;
        filtered.sort((a, b) => {
            if (orderBy === 'date-desc') return new Date(b.expense_date) - new Date(a.expense_date);
            if (orderBy === 'date-asc') return new Date(a.expense_date) - new Date(b.expense_date);
            if (orderBy === 'amount-desc') return Number(b.amount || 0) - Number(a.amount || 0);
            if (orderBy === 'amount-asc') return Number(a.amount || 0) - Number(b.amount || 0);
            return 0;
        });

        filteredExpenses = filtered;
        currentPage = 1;
        renderTable(filteredExpenses);
    }

    // Renderiza tabla paginada de gastos con acceso opcional al comprobante.
    function renderTable(expenses) {
        if (!expenses.length) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Sin gastos registrados</td></tr>';
            paginationBox.style.display = 'none';
            return;
        }

        const totalPages = Math.max(1, Math.ceil(expenses.length / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;

        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = expenses.slice(start, start + PAGE_SIZE);

        paginationBox.style.display = totalPages > 1 ? 'flex' : 'none';
        pageIndicator.textContent = `Pagina ${currentPage} de ${totalPages}`;
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;

        tbody.innerHTML = pageItems.map(exp => {
            const description = escapeHtml(exp.description || 'Sin descripcion');
            const date = exp.expense_date
                ? new Date(exp.expense_date).toLocaleString('es-MX', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                })
                : '-';
            const amount = Number(exp.amount || 0).toLocaleString('es-MX', {
                style: 'currency',
                currency: 'MXN',
                minimumFractionDigits: 2
            });
            const hasImage = Boolean(exp.url_image);
            const imageBadge = hasImage
                ? `<button type="button" class="receipt-thumb-btn" data-image="${escapeHtml(exp.url_image).replace(/\"/g, '&quot;')}">Ver comprobante</button>`
                : '<span class="no-proof">Sin comprobante</span>';

            return `
                <tr>
                    <td>
                        <p class="expense-description">${description}</p>
                        <small>${imageBadge}</small>
                    </td>
                    <td>${date}</td>
                    <td>${amount}</td>
                </tr>
            `;
        }).join('');
    }

    // Genera etiqueta mensual para el filtro de periodo.
    function formatMonthYear(dateValue) {
        if (!dateValue) return '-';
        const d = new Date(dateValue);
        return d.toLocaleString('es-MX', { month: 'long', year: 'numeric' });
    }

    // Evita inyeccion HTML en texto dinamico.
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});
