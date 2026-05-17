/**
 * TESINA: Tablon de gastos de condominio.
 * Responsabilidad: listar gastos, aplicar filtros, paginar y gestionar CRUD con ventana de 30 días.
 * Flujo: obtener gastos -> filtrar/ordenar -> renderizar tabla -> crear/editar/eliminar.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('expenses-tbody');
    const monthSelect = document.getElementById('month-filter');
    const amountSelect = document.getElementById('amount-filter');
    const orderSelect = document.getElementById('order-by');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    const paginationBox = document.getElementById('expenses-pagination');
    const prevBtn = document.getElementById('exp-prev-btn');
    const nextBtn = document.getElementById('exp-next-btn');
    const pageIndicator = document.getElementById('exp-page-indicator');

    // Elementos del formulario integrado
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
    const formTitle = document.getElementById('expense-form-title');

    const sessionUser = window.ADIAuth?.getCurrentUser?.();
    const canManageExpenses = Number(sessionUser?.rol_id || 0) >= 2;
    // Ventana para editar/borrar gastos: 30 días (en horas)
    const EDIT_WINDOW_HOURS = 24 * 30; // 720 horas

    let allExpenses = [];
    let filteredExpenses = [];
    const PAGE_SIZE = 10;
    let currentPage = 1;
    let imageData = '';
    let editingExpenseId = null;

    await reloadExpenses();

    // Event listeners para filtros
    monthSelect.addEventListener('change', applyFilters);
    amountSelect.addEventListener('change', applyFilters);
    orderSelect.addEventListener('change', applyFilters);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);

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

    // Event listeners para visualizar comprobantes y acciones
    tbody.addEventListener('click', async (e) => {
        const createBtn = e.target.closest('.open-expense-form-btn');
        if (createBtn) {
            openCreateForm();
            return;
        }

        const trigger = e.target.closest('.receipt-thumb-btn');
        if (trigger) {
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
            return;
        }

        const editBtn = e.target.closest('.expense-edit-btn');
        if (editBtn) {
            const expenseId = Number(editBtn.dataset.id);
            const exp = allExpenses.find(x => Number(x.id) === expenseId);
            if (!exp) return;

                if (!canEditExpense(exp)) {
                Swal.fire({
                    title: 'Fuera de rango',
                    text: 'Solo puedes editar gastos dentro de 30 días.',
                    icon: 'warning',
                    confirmButtonColor: '#ED7A13',
                    confirmButtonText: 'Aceptar'
                });
                return;
            }

            openEditForm(exp);
            return;
        }

        const deleteBtn = e.target.closest('.expense-delete-btn');
        if (deleteBtn) {
            const expenseId = Number(deleteBtn.dataset.id);
            const exp = allExpenses.find(x => Number(x.id) === expenseId);
            if (!exp) return;
                if (!canEditExpense(exp)) {
                Swal.fire({
                    title: 'Fuera de rango',
                    text: 'Solo puedes borrar gastos dentro de 30 días.',
                    icon: 'warning',
                    confirmButtonColor: '#ED7A13',
                    confirmButtonText: 'Aceptar'
                });
                return;
            }

            await withButtonLock(deleteBtn, async () => await handleDeleteExpense(expenseId, deleteBtn), { loadingText: 'ELIMINANDO...' });
        }
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

        if (file.size > 5 * 1024 * 1024) {
            Swal.fire({
                title: 'Archivo muy grande',
                text: 'El comprobante no debe superar 5MB.',
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
            previewImage.src = imageData;
            previewImage.style.display = 'block';
            uploadIcon.style.display = 'none';
            uploadName.textContent = file.name;
        };
        reader.readAsDataURL(file);
    });

    saveBtn.addEventListener('click', async () => {
        await withButtonLock(saveBtn, async () => {
            const amount = amountInput.value;
            const description = notesInput.value.trim();
            const parsedAmount = Number.parseFloat(amount);

            if (!amount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
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

            if (description.length < 3 || description.length > 150) {
                Swal.fire({
                    title: 'Descripción inválida',
                    text: 'La descripción debe tener entre 3 y 150 caracteres.',
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

            try {
                const endpoint = editingExpenseId
                    ? `/api/accounting/expenses/${encodeURIComponent(editingExpenseId)}`
                    : '/api/accounting/expenses';
                const method = editingExpenseId ? 'PATCH' : 'POST';

                const payload = {
                    amount: parsedAmount,
                    description,
                    image_data: imageData
                };
                if (!editingExpenseId) {
                    payload.expense_date = new Date().toISOString();
                }

                const response = await fetch(endpoint, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
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
                    title: editingExpenseId ? 'Gasto actualizado' : 'Gasto registrado',
                    text: editingExpenseId ? 'El gasto se actualizó correctamente.' : 'El gasto se guardó correctamente.',
                    icon: 'success',
                    timer: 1700,
                    timerProgressBar: true,
                    showConfirmButton: false,
                    confirmButtonColor: '#6A8042'
                });

                closeExpenseForm();
                await reloadExpenses();
            } catch {
                Swal.fire({
                    title: 'Error de conexión',
                    text: 'No se pudo guardar el gasto.',
                    icon: 'error',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Aceptar'
                });
            } finally {
                // button state restored by withButtonLock
            }
        }, { loadingText: 'GUARDANDO...' });
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
        editingExpenseId = null;
        if (formTitle) formTitle.textContent = 'LEVANTAR GASTO';
        saveBtn.textContent = 'SUBIR';
    }

    function closeExpenseForm() {
        resetExpenseForm();
        expenseFormPanel.style.display = 'none';
    }

    function clearFilters() {
        monthSelect.value = 'any';
        amountSelect.value = 'any';
        orderSelect.value = 'date-desc';
        applyFilters();
    }

    // Llena periodos unicos para filtrar por mes y anio del gasto.
    function populateMonthFilter(expenses) {
        monthSelect.innerHTML = '<option value="any">Cualquiera</option>';
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
        const createRow = canManageExpenses
            ? `
                <tr class="create-expense-row">
                    <td colspan="4">
                        <button type="button" class="btn-create-expense open-expense-form-btn" aria-label="Levantar gasto">
                            <span class="material-symbols-outlined">add_circle</span>
                            <span>LEVANTAR GASTO</span>
                        </button>
                    </td>
                </tr>
            `
            : '';

        if (!expenses.length) {
            tbody.innerHTML = `${createRow}<tr><td colspan="4" style="text-align:center">Sin gastos registrados</td></tr>`;
            paginationBox.style.display = 'none';
            return;
        }

        const totalPages = Math.max(1, Math.ceil(expenses.length / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;

        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = expenses.slice(start, start + PAGE_SIZE);

        paginationBox.style.display = totalPages > 1 ? 'flex' : 'none';
        pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;

        tbody.innerHTML = `${createRow}${pageItems.map(exp => {
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

            const withinWindow = canEditExpense(exp);
            const actions = canManageExpenses
                ? `
                    <div class="expense-actions">
                        <button type="button" class="expense-edit-btn" data-id="${exp.id}" ${withinWindow ? '' : 'disabled'}>Editar</button>
                        <button type="button" class="expense-delete-btn" data-id="${exp.id}" ${withinWindow ? '' : 'disabled'}>Borrar</button>
                    </div>
                  `
                : '<span class="no-proof">Sin permisos</span>';

            return `
                <tr>
                    <td>
                        <p class="expense-description">${description}</p>
                        <small>${imageBadge}</small>
                    </td>
                    <td>${date}</td>
                    <td>${amount}</td>
                    <td>${actions}</td>
                </tr>
            `;
        }).join('')}`;
    }

    function openCreateForm() {
        resetExpenseForm();
        expenseFormPanel.style.display = 'block';
        expenseFormPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function openEditForm(expense) {
        resetExpenseForm();
        editingExpenseId = Number(expense.id);
        if (formTitle) formTitle.textContent = 'EDITAR GASTO';
        saveBtn.textContent = 'GUARDAR CAMBIOS';

        amountInput.value = Number(expense.amount || 0).toFixed(2);
        notesInput.value = String(expense.description || '');
        charCounter.textContent = `${notesInput.value.length} / 150`;
        imageData = String(expense.url_image || '').trim();
        confirmInput.checked = true;

        if (imageData) {
            previewImage.src = imageData;
            previewImage.style.display = 'block';
            uploadIcon.style.display = 'none';
            uploadName.textContent = 'Comprobante actual cargado';
        }

        expenseFormPanel.style.display = 'block';
        expenseFormPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function handleDeleteExpense(expenseId, btn) {
        const confirmation = await Swal.fire({
            title: '¿Borrar gasto?',
            text: 'Esta acción no se puede deshacer.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Sí, borrar'
        });

        if (!confirmation.isConfirmed) return;

        const originalText = btn?.textContent || '';

        try {
            const response = await fetch(`/api/accounting/expenses/${encodeURIComponent(expenseId)}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();
            if (!result.success) {
                Swal.fire({
                    title: 'Error al borrar',
                    text: result.message || 'No se pudo borrar el gasto.',
                    icon: 'error',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Aceptar'
                });
                return;
            }

            await Swal.fire({
                title: 'Gasto eliminado',
                text: 'El gasto se eliminó correctamente.',
                icon: 'success',
                timer: 1500,
                timerProgressBar: true,
                showConfirmButton: false,
                confirmButtonColor: '#6A8042'
            });

            await reloadExpenses();
        } catch (error) {
            Swal.fire({
                title: 'Error de conexión',
                text: 'No se pudo borrar el gasto.',
                icon: 'error',
                confirmButtonColor: '#d33',
                confirmButtonText: 'Aceptar'
            });
        }
    }

    function canEditExpense(exp) {
        if (!exp || !exp.expense_date) return false;
        const expenseDate = new Date(exp.expense_date);
        if (Number.isNaN(expenseDate.getTime())) return false;
        const diffHours = (Date.now() - expenseDate.getTime()) / (1000 * 60 * 60);
        return diffHours < EDIT_WINDOW_HOURS;
    }

    async function reloadExpenses() {
        return await withLock('expenses-reload', async () => {
            try {
                const response = await fetch('/api/accounting/expenses-board');
                const data = await response.json();

                if (!data.success) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Error al cargar gastos</td></tr>';
                    return;
                }

                allExpenses = data.expenses || [];
                populateMonthFilter(allExpenses);
                applyFilters();
            } catch (error) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Error al cargar gastos</td></tr>';
            }
        });
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
