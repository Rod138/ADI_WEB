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

    let allExpenses = [];
    let filteredExpenses = [];
    const PAGE_SIZE = 10;
    let currentPage = 1;

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

    monthSelect.addEventListener('change', applyFilters);
    amountSelect.addEventListener('change', applyFilters);
    orderSelect.addEventListener('change', applyFilters);

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
