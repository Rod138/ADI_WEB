/**
 * TESINA: Generacion y visualizacion de reportes contables en cliente.
 * Responsabilidad: construir tabla/grafica y preparar exportaciones.
 * Flujo: filtrar dataset -> renderizar vista -> descargar resultado.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const typeSelect = document.getElementById('report-type');
    const yearSelect = document.getElementById('report-year');
    const monthSelect = document.getElementById('report-month');
    const viewSelect = document.getElementById('report-view');
    const chartContainer = document.getElementById('chart-container');
    const tableContainer = document.getElementById('table-container');
    const emptyContainer = document.getElementById('empty-container');
    const emptyState = document.getElementById('reports-empty-state');
    const head = document.getElementById('reports-head');
    const body = document.getElementById('reports-body');
    const downloadBtn = document.getElementById('download-pdf-btn');

    const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    let chart = null;
    let lastRenderedRows = [];
    let lastRenderedHeaders = [];
    let resizeTimer = null;
    let chartResizeObserver = null;

    let reportsData = {
        payments: [],
        expenses: [],
        quotas: [],
        departments: [],
        incidents: [],
        fundInitial: 0
    };

    monthSelect.innerHTML += MONTHS.map((m, idx) => `<option value="${idx + 1}">${m}</option>`).join('');

    try {
            await withLock('reports-data', async () => {
            const [reportsRes, financeRes] = await Promise.all([
                fetch('/api/accounting/reports-data'),
                fetch('/api/accounting/finance-config')
            ]);

            const data = await reportsRes.json();
            const finance = await financeRes.json().catch(() => null);

            if (!data.success) {
                Swal.fire({
                    title: 'Error al cargar',
                    text: data.message || 'No se pudieron cargar los reportes.',
                    icon: 'error',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Aceptar'
                });
                return;
            }

            reportsData = {
                payments: data.payments || [],
                expenses: data.expenses || [],
                quotas: data.quotas || [],
                departments: data.departments || [],
                incidents: data.incidents || [],
                incidentTypes: data.incidentTypes || []
            };

            // Load initial tower fund (used to compute balance)
            if (finance && finance.success && finance.fund) {
                reportsData.fundInitial = Number(finance.fund.initial_amount || 0);
            } else {
                reportsData.fundInitial = 0;
            }

            populateYears();
            applyDefaultFilters();
            syncControlsForType();
            syncMonthFilterRules();
            render();
        });
    } catch (error) {
        Swal.fire({
            title: 'Error de conexión',
            text: 'Fallo de red al cargar reportes.',
            icon: 'error',
            confirmButtonColor: '#d33',
            confirmButtonText: 'Aceptar'
        });
        return;
    }

    [typeSelect, yearSelect, monthSelect, viewSelect].forEach(el => {
        el.addEventListener('change', () => {
            syncControlsForType();
            syncMonthFilterRules();
            render();
        });
    });

    downloadBtn.addEventListener('click', handleDownloadClick);

    // Decide ruta de descarga segun tipo de reporte seleccionado.
    async function handleDownloadClick() {
        if (isMonthlyPdfType()) {
            await handlePdfDownload();
            return;
        }

        handleImageDownload();
    }

    // Exporta la visualizacion actual (tabla/grafica) como imagen JPG.
    function handleImageDownload() {
        if (viewSelect.value === 'chart' && chart) {
            const canvas = document.getElementById('reports-chart');
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = canvas.width;
            exportCanvas.height = canvas.height;

            const exportCtx = exportCanvas.getContext('2d');
            exportCtx.fillStyle = '#FFFFFF';
            exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
            exportCtx.drawImage(canvas, 0, 0);

            const url = exportCanvas.toDataURL('image/jpeg', 0.95);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${typeSelect.value}_grafica_${yearSelect.value}_${monthSelect.value}.jpg`;
            link.click();
        } else {
            if (!lastRenderedRows.length) {
                Swal.fire({
                    title: 'Sin datos',
                    text: 'No hay datos para descargar.',
                    icon: 'info',
                    confirmButtonColor: '#0099ff',
                    confirmButtonText: 'Aceptar'
                });
                return;
            }

            if (typeof html2canvas === 'undefined') {
                Swal.fire({
                    title: 'No disponible',
                    text: 'Descarga de tabla como PNG no está disponible.',
                    icon: 'warning',
                    confirmButtonColor: '#ED7A13',
                    confirmButtonText: 'Aceptar'
                });
                return;
            }

            const table = document.getElementById('reports-table');
            html2canvas(table).then(canvas => {
                const url = canvas.toDataURL('image/jpeg');
                const link = document.createElement('a');
                link.href = url;
                link.download = `${typeSelect.value}_tabla_${yearSelect.value}_${monthSelect.value}.jpg`;
                link.click();
            });
        }
    }

    // Inicializa lista de anios disponibles usando todas las fuentes de datos.
    function populateYears() {
        const years = new Set();
        const currentYear = new Date().getFullYear();
        years.add(currentYear);

        reportsData.payments.forEach(r => {
            if (r.year) years.add(Number(r.year));
        });

        reportsData.quotas.forEach(r => {
            if (r.year) years.add(Number(r.year));
        });

        reportsData.expenses.forEach(r => {
            if (r.expense_date) years.add(new Date(r.expense_date).getFullYear());
        });

        const sorted = [...years].sort((a, b) => b - a);
        yearSelect.innerHTML = sorted.map(y => `<option value="${y}">${y}</option>`).join('');
    }

    // Define filtros iniciales para ofrecer una primera vista util.
    function applyDefaultFilters() {
        const now = new Date();
        typeSelect.value = 'balance';
        viewSelect.value = 'monthly-financial-pdf';
        monthSelect.value = String(now.getMonth() + 1);

        const currentYear = String(now.getFullYear());
        const yearOptionExists = [...yearSelect.options].some(o => o.value === currentYear);
        yearSelect.value = yearOptionExists ? currentYear : (yearSelect.options[0]?.value || currentYear);
    }

    // Identifica si el modo activo corresponde al reporte mensual formal PDF.
    function isMonthlyPdfType() {
        return viewSelect.value === 'monthly-financial-pdf';
    }

    // Ajusta controles de interfaz segun restricciones del tipo de reporte.
    function syncControlsForType() {
        const monthlyPdf = isMonthlyPdfType();

        typeSelect.disabled = monthlyPdf;
        if (monthlyPdf) {
            typeSelect.value = 'balance';
        }
    }

    // Bloquea opcion "cualquiera" cuando el reporte requiere mes especifico.
    function syncMonthFilterRules() {
        const lockAnyMonth = isMonthlyPdfType() || (typeSelect.value === 'payments' && viewSelect.value === 'table');
        const anyMonthOption = monthSelect.querySelector('option[value="any"]');
        if (!anyMonthOption) return;

        anyMonthOption.hidden = lockAnyMonth;
        if (lockAnyMonth && monthSelect.value === 'any') {
            monthSelect.value = String(new Date().getMonth() + 1);
        }
    }

    // Punto central de renderizado: deriva salida grafica, tabular o estado vacio.
    function render() {
        hideEmptyState();
        const mode = viewSelect.value;
        const type = typeSelect.value;
        const selectedYear = yearSelect.value;
        const selectedMonth = monthSelect.value;
        const wideOutputMode = mode === 'chart' || isMonthlyPdfType();

        document.body.classList.toggle('reports-wide-output', wideOutputMode);
        document.body.classList.toggle('reports-table-output', mode === 'table');

        if (isMonthlyPdfType()) {
            chartContainer.style.display = 'none';
            tableContainer.style.display = 'none';
            emptyContainer.style.display = 'block';
            head.innerHTML = '';
            body.innerHTML = '';
            lastRenderedHeaders = [];
            lastRenderedRows = [];
            showEmptyState('Reporte financiero mensual listo para descarga en PDF. Selecciona mes y presiona DESCARGAR.');
            return;
        }

        if (mode === 'chart') {
            chartContainer.style.display = 'block';
            tableContainer.style.display = 'none';
            emptyContainer.style.display = 'none';
            renderChart(type, selectedYear, selectedMonth);
        } else {
            chartContainer.style.display = 'none';
            tableContainer.style.display = 'block';
            emptyContainer.style.display = 'none';
            renderTable(type, selectedYear, selectedMonth);
        }
    }

    // Construye datasets agregados y dibuja la grafica segun tipo de reporte.
    function renderChart(type, selectedYear, selectedMonth) {
        const ctx = document.getElementById('reports-chart');
        const periodMap = buildPeriodMap();
        const periodKeys = getDisplayPeriods(periodMap, selectedYear, selectedMonth, type);
        const rows = periodKeys.map(key => periodMap[key] || emptyPeriod(key));
        const labels = rows.map(r => formatPeriodLabel(r.period));

        let datasets = [];
        let hasPlottableData = false;
        if (type === 'payments') {
            datasets = [{
                label: 'Pagos de cuota',
                data: rows.map(r => round2(r.payments)),
                borderColor: '#6A8042',
                backgroundColor: 'rgba(106,128,66,0.18)',
                tension: 0.25,
                fill: false
            }];
            hasPlottableData = rows.some(r => r.payments > 0);
        } else if (type === 'balance') {
            datasets = [
                {
                    label: 'Ingresos',
                    data: rows.map(r => round2(r.payments)),
                    borderColor: '#6A8042',
                    backgroundColor: 'rgba(106,128,66,0.18)',
                    tension: 0.25,
                    fill: false
                },
                {
                    label: 'Gastos',
                    data: rows.map(r => round2(r.expenses)),
                    borderColor: '#ED7A13',
                    backgroundColor: 'rgba(237,122,19,0.2)',
                    tension: 0.25,
                    fill: false
                },
                {
                    label: 'Balance',
                    data: (function(){
                        const initial = Number(reportsData.fundInitial || 0);
                        let cum = initial;
                        return rows.map(r => {
                            cum += (Number(r.payments || 0) - Number(r.expenses || 0));
                            return round2(cum);
                        });
                    })(),
                    borderColor: '#111111',
                    backgroundColor: 'rgba(17,17,17,0.12)',
                    tension: 0.25,
                    fill: false
                }
            ];
            hasPlottableData = rows.some(r => r.payments > 0 || r.expenses > 0);
        } else if (type === 'incident-types') {
            const incidentStats = getIncidentTypeStats(selectedYear, selectedMonth);
            datasets = [{
                label: 'Incidencias',
                data: incidentStats.map(item => item.count),
                backgroundColor: '#6A8042',
                borderColor: '#4D5D34'
            }];

            if (chart) {
                chart.destroy();
            }

            if (!incidentStats.length) {
                chartContainer.style.display = 'none';
                tableContainer.style.display = 'none';
                emptyContainer.style.display = 'block';
                showEmptyState('Sin datos para el mes y año seleccionados.');
                lastRenderedHeaders = [];
                lastRenderedRows = [];
                return;
            }

            chart = new Chart(ctx, {
                type: 'bar',
                data: { labels: incidentStats.map(item => item.label), datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 } }
                    }
                }
            });

            lastRenderedHeaders = ['Tipo de incidencia', 'Cantidad'];
            lastRenderedRows = incidentStats.map(item => [item.label, item.count]);
            return;
        }

        if (chart) {
            chart.destroy();
        }

        if (!periodKeys.length || !hasPlottableData) {
            chartContainer.style.display = 'none';
            tableContainer.style.display = 'none';
            emptyContainer.style.display = 'block';
            showEmptyState('Sin datos para el mes y año seleccionados.');
            lastRenderedHeaders = [];
            lastRenderedRows = [];
            return;
        }

        chart = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        lastRenderedHeaders = ['Periodo', ...datasets.map(d => d.label)];
        lastRenderedRows = rows.map((r, idx) => {
            const row = [labels[idx]];
            datasets.forEach(d => row.push(d.data[idx]));
            return row;
        });

        scheduleChartResize();
        bindChartResizeObserver();
    }

    // Genera tabla detallada para analisis textual de resultados filtrados.
    function renderTable(type, selectedYear, selectedMonth) {
        let headers = [];
        let renderedRows = [];

        const selectedYearNum = Number(selectedYear);
        const selectedMonthNum = selectedMonth === 'any' ? null : Number(selectedMonth);

        if (type === 'balance') {
            headers = ['Período', 'Movimiento', 'Origen', 'Referencia', 'Cantidad'];
            renderedRows = getBalanceMovementRows(selectedYear, selectedMonth);

            let totalAmount = 0;
            renderedRows.forEach(row => {
                totalAmount += Number(row[5] || 0);
            });

            // Include initial tower fund in the accumulated balance
            totalAmount += Number(reportsData.fundInitial || 0);

            if (renderedRows.length > 0) {
                renderedRows.push(['TOTAL', 'Balance acumulado', '-', '-', formatSigned(totalAmount), 0]);
            }
        } else if (type === 'incident-types') {
            headers = ['Tipo de incidencia', 'Cantidad'];
            renderedRows = getIncidentTypeStats(selectedYear, selectedMonth).map(item => [item.label, item.count]);
        } else if (type === 'payments') {
            headers = ['Departamento', 'Estado', 'Monto Pagado', 'Monto Esperado'];

            let targetYear = selectedYearNum;
            let targetMonth = selectedMonthNum;

            if (!targetMonth) {
                const months = new Set();
                reportsData.payments
                    .filter(p => Number(p.year) === targetYear)
                    .forEach(p => months.add(monthNameToNumber(p.month)));
                targetMonth = months.size ? Math.max(...months) : new Date().getMonth() + 1;
            }

            const paidDepts = new Set();
            const paymentsByDept = {};

            reportsData.payments
                .filter(p => Number(p.year) === targetYear && monthNameToNumber(p.month) === targetMonth)
                .forEach(p => {
                    paidDepts.add(p.dep_id);
                    paymentsByDept[p.dep_id] = {
                        amount_paid: p.amount_paid,
                        amount_expected: p.amount_expected,
                        validated: p.validated
                    };
                });

            renderedRows = reportsData.departments.map(dept => {
                const isPaid = paidDepts.has(dept.id);
                const paymentData = paymentsByDept[dept.id] || {};

                return [
                    dept.name || `DEP ${dept.id}`,
                    isPaid ? '✓ Pagado' : '✗ No Pagado',
                    isPaid ? round2(paymentData.amount_paid) : '-',
                    isPaid ? round2(paymentData.amount_expected) : '-'
                ];
            });
        }

        head.innerHTML = `<tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;

        if (!renderedRows.length) {
            chartContainer.style.display = 'none';
            tableContainer.style.display = 'none';
            emptyContainer.style.display = 'block';
            showEmptyState('Sin datos para el mes y año seleccionados.');
            head.innerHTML = '';
            body.innerHTML = '';
            lastRenderedHeaders = [];
            lastRenderedRows = [];
        } else {
            chartContainer.style.display = 'none';
            tableContainer.style.display = 'block';
            emptyContainer.style.display = 'none';
            body.innerHTML = renderedRows.map(row => buildStyledRow(row, type)).join('');
            lastRenderedHeaders = headers;
            lastRenderedRows = renderedRows;
        }
    }

    // Aplica formato visual condicional por signo y contexto del movimiento.
    function buildStyledRow(row, type) {
        if (type !== 'balance') {
            return `<tr>${row.map(col => `<td>${escapeHtml(col)}</td>`).join('')}</tr>`;
        }

        const isTotal = row[0] === 'TOTAL';
        const signed = String(row[4] || '').trim();
        let amountClass = '';

        if (signed.startsWith('+')) amountClass = 'movement-income';
        if (signed.startsWith('-')) amountClass = 'movement-expense';

        return `<tr${isTotal ? ' class="movement-total-row"' : ''}><td>${escapeHtml(row[0])}</td><td>${escapeHtml(row[1])}</td><td>${escapeHtml(row[2])}</td><td>${escapeHtml(row[3])}</td><td class="${amountClass}">${escapeHtml(row[4])}</td></tr>`;
    }

    // Deriva movimientos de ingreso/egreso para el reporte de balance.
    function getBalanceMovementRows(selectedYear, selectedMonth) {
        const selectedYearNum = Number(selectedYear);
        const selectedMonthNum = selectedMonth === 'any' ? null : Number(selectedMonth);
        const rows = [];

        const paymentGroups = {};
        reportsData.payments.forEach(p => {
            const monthNo = monthNameToNumber(p.month);
            const yearNo = Number(p.year);
            if (!monthNo || !yearNo) return;
            if (yearNo !== selectedYearNum) return;
            if (selectedMonthNum !== null && monthNo !== selectedMonthNum) return;

            const key = `${yearNo}-${String(monthNo).padStart(2, '0')}`;
            if (!paymentGroups[key]) {
                paymentGroups[key] = { total: 0, count: 0 };
            }
            paymentGroups[key].total += Number(p.amount_paid || 0);
            paymentGroups[key].count += 1;
        });

        Object.keys(paymentGroups).forEach(key => {
            const group = paymentGroups[key];
            rows.push([
                formatPeriodLabel(key),
                'Ingreso',
                'Pago de cuota',
                'Pagos de cuota mensual',
                formatSigned(group.total),
                group.total
            ]);
        });

        reportsData.expenses.forEach(exp => {
            if (!exp.expense_date) return;
            const d = new Date(exp.expense_date);
            const yearNo = d.getFullYear();
            const monthNo = d.getMonth() + 1;
            if (yearNo !== selectedYearNum) return;
            if (selectedMonthNum !== null && monthNo !== selectedMonthNum) return;

            const amount = Number(exp.amount || 0);
            rows.push([
                formatPeriodLabel(`${yearNo}-${String(monthNo).padStart(2, '0')}`),
                'Gasto',
                'Gasto directo',
                exp.description || `Gasto #${exp.id}`,
                formatSigned(-amount),
                -amount
            ]);
        });

        reportsData.incidents.forEach(inc => {
            const amount = Number(inc.cost || 0);
            if (amount <= 0) return;

            const baseDate = inc.completed_at || inc.created_at;
            if (!baseDate) return;

            const d = new Date(baseDate);
            const yearNo = d.getFullYear();
            const monthNo = d.getMonth() + 1;
            if (yearNo !== selectedYearNum) return;
            if (selectedMonthNum !== null && monthNo !== selectedMonthNum) return;

            const incidentType = getIncidentTypeName(inc.type_id);

            rows.push([
                formatPeriodLabel(`${yearNo}-${String(monthNo).padStart(2, '0')}`),
                'Gasto',
                'Incidencia',
                incidentType,
                formatSigned(-amount),
                -amount
            ]);
        });

        return rows.sort((a, b) => {
            const dateA = parsePeriodLabel(a[0]);
            const dateB = parsePeriodLabel(b[0]);
            if (dateA !== dateB) return dateA - dateB;
            if (a[1] === b[1]) return 0;
            return a[1] === 'Ingreso' ? -1 : 1;
        });
    }

    // Convierte etiqueta "Mes Anio" a clave numerica comparable.
    function parsePeriodLabel(label) {
        const parts = String(label).split(' ');
        const monthName = (parts[0] || '').toLowerCase();
        const year = Number(parts[1] || 0);
        const month = monthNameToNumber(monthName) || 1;
        return year * 100 + month;
    }

    // Resuelve nombre de tipo de incidencia desde su identificador.
    function getIncidentTypeName(typeId) {
        const incidentType = reportsData.incidentTypes.find(item => String(item.id) === String(typeId));
        return incidentType?.name || incidentType?.type || `Tipo #${typeId ?? '-'}`;
    }

    // Agrupa incidencias por tipo para estadistica mensual/anual.
    function getIncidentTypeStats(selectedYear, selectedMonth) {
        const selectedYearNum = Number(selectedYear);
        const selectedMonthNum = selectedMonth === 'any' ? null : Number(selectedMonth);
        const counts = new Map();

        reportsData.incidents.forEach(inc => {
            const baseDate = inc.completed_at || inc.created_at;
            if (!baseDate) return;

            const d = new Date(baseDate);
            const yearNo = d.getFullYear();
            const monthNo = d.getMonth() + 1;
            if (yearNo !== selectedYearNum) return;
            if (selectedMonthNum !== null && monthNo !== selectedMonthNum) return;

            const label = getIncidentTypeName(inc.type_id);
            counts.set(label, (counts.get(label) || 0) + 1);
        });

        return [...counts.entries()]
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'));
    }

    // Define periodos visibles en la salida temporal segun filtro activo.
    function getDisplayPeriods(periodMap, selectedYear, selectedMonth, type) {
        const isAllMonths = selectedMonth === 'any' || String(selectedMonth).toLowerCase() === 'any';
        const year = Number(selectedYear);

        if (!isAllMonths) {
            const selectedMonthNum = Number(selectedMonth);
            if (!isNaN(selectedMonthNum) && selectedMonthNum > 0) {
                const selectedKey = `${year}-${String(selectedMonthNum).padStart(2, '0')}`;

                if (type === 'payments' || type === 'balance') {
                    const nextKey = getNextPeriodKey(year, selectedMonthNum);
                    return [selectedKey, nextKey];
                }

                return [selectedKey];
            }
        }

        return Object.keys(periodMap)
            .sort()
            .filter(key => Number(key.split('-')[0]) === year);
    }

    // Calcula la clave del mes siguiente para proyecciones simples.
    function getNextPeriodKey(year, month) {
        const date = new Date(year, month - 1, 1);
        date.setMonth(date.getMonth() + 1);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    // Muestra panel de estado vacio con mensaje contextual.
    function showEmptyState(message) {
        emptyState.textContent = message;
        emptyState.style.display = 'flex';
    }

    // Oculta panel de estado vacio para volver a vista de datos.
    function hideEmptyState() {
        emptyState.style.display = 'none';
        emptyState.textContent = '';
    }

    // Fabrica estructura base de periodo sin movimientos.
    function emptyPeriod(key) {
        return {
            period: key,
            payments: 0,
            expenses: 0,
            expected: 0,
            records: 0
        };
    }

    // Formatea valores con signo para lectura financiera rapida.
    function formatSigned(value) {
        const number = round2(value);
        if (number > 0) return `+ ${number}`;
        if (number < 0) return `- ${Math.abs(number)}`;
        return '0';
    }

    // Consolida pagos, gastos e incidencias en un mapa por periodo.
    function buildPeriodMap() {
        const map = {};

        const setPeriod = (key) => {
            if (!map[key]) {
                map[key] = {
                    period: key,
                    payments: 0,
                    expenses: 0,
                    expected: 0,
                    records: 0
                };
            }
            return map[key];
        };

        reportsData.payments.forEach(p => {
            const monthNo = monthNameToNumber(p.month);
            if (!p.year || !monthNo) return;
            const key = `${p.year}-${String(monthNo).padStart(2, '0')}`;
            const row = setPeriod(key);
            row.payments += Number(p.amount_paid || 0);
            row.expected += Number(p.amount_expected || 0);
            row.records += 1;
        });

        reportsData.expenses.forEach(e => {
            if (!e.expense_date) return;
            const d = new Date(e.expense_date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const row = setPeriod(key);
            row.expenses += Number(e.amount || 0);
        });

        reportsData.incidents.forEach(inc => {
            const amount = Number(inc.cost || 0);
            if (amount <= 0) return;

            const baseDate = inc.completed_at || inc.created_at;
            if (!baseDate) return;

            const d = new Date(baseDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const row = setPeriod(key);
            row.expenses += amount;
        });

        reportsData.quotas.forEach(q => {
            const monthNo = monthNameToNumber(q.month);
            if (!q.year || !monthNo) return;
            const key = `${q.year}-${String(monthNo).padStart(2, '0')}`;
            const row = setPeriod(key);
            if (!row.expected) {
                row.expected += Number(q.amount || 0);
            }
        });

        return map;
    }

    // Convierte clave YYYY-MM a etiqueta humana en espanol.
    function formatPeriodLabel(periodKey) {
        const [y, m] = String(periodKey).split('-');
        const monthName = MONTHS[Number(m) - 1] || m;
        return `${monthName} ${y}`;
    }

    // Normaliza nombre de mes (incluye variantes) a numero.
    function monthNameToNumber(monthName) {
        const normalized = String(monthName || '').trim().toLowerCase();
        const map = {
            enero: 1,
            febrero: 2,
            marzo: 3,
            abril: 4,
            mayo: 5,
            junio: 6,
            julio: 7,
            agosto: 8,
            septiembre: 9,
            setiembre: 9,
            octubre: 10,
            noviembre: 11,
            diciembre: 12
        };
        return map[normalized] || null;
    }

    // Redondea a dos decimales para consistencia contable.
    function round2(value) {
        return Math.round(Number(value || 0) * 100) / 100;
    }

    function scheduleChartResize() {
        if (!chart) return;
        if (resizeTimer) window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
            if (!chart) return;
            chart.resize();
        }, 150);
    }

    window.addEventListener('resize', scheduleChartResize);

    function bindChartResizeObserver() {
        if (!chart) return;

        if (!chartResizeObserver && typeof ResizeObserver !== 'undefined') {
            chartResizeObserver = new ResizeObserver(() => {
                if (resizeTimer) window.clearTimeout(resizeTimer);
                resizeTimer = window.setTimeout(() => {
                    if (chart) {
                        chart.resize();
                    }
                }, 200);
            });
        }

        if (!chartResizeObserver) return;

        const chartWrap = document.querySelector('.reports-page .chart-wrap');
        if (!chartWrap) return;

        chartResizeObserver.disconnect();
        chartResizeObserver.observe(chartWrap);
    }

    // Orquesta validaciones y descarga del reporte mensual en PDF.
    async function handlePdfDownload() {
        if (typeof html2pdf === 'undefined') {
            Swal.fire({
                title: 'No disponible',
                text: 'La exportación PDF no está disponible en este navegador.',
                icon: 'warning',
                confirmButtonColor: '#ED7A13',
                confirmButtonText: 'Aceptar'
            });
            return;
        }

        if (monthSelect.value === 'any') {
            Swal.fire({
                title: 'Selecciona un mes',
                text: 'Para el reporte PDF mensual necesitas elegir un mes específico.',
                icon: 'info',
                confirmButtonColor: '#0099ff',
                confirmButtonText: 'Aceptar'
            });
            return;
        }

        const selectedYear = Number(yearSelect.value);
        const selectedMonth = Number(monthSelect.value);

        if (!selectedYear || !selectedMonth) {
            Swal.fire({
                title: 'Filtros incompletos',
                text: 'Selecciona año y mes para descargar el PDF.',
                icon: 'info',
                confirmButtonColor: '#0099ff',
                confirmButtonText: 'Aceptar'
            });
            return;
        }

        const logoBase64 = await loadLogoBase64('/FrontEnd/IMG/logo.png');
        const reportData = await buildMonthlyPdfData(selectedYear, selectedMonth, logoBase64);
        const html = generateMonthlyReportHTML(reportData);

        const filename = `reporte_financiero_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.pdf`;

        try {
            await html2pdf()
                .set({
                    margin: [8, 8, 8, 8],
                    filename,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                    pagebreak: { mode: ['css', 'legacy'] }
                })
                .from(html, 'string')
                .save();
        } catch (error) {
            console.error('Error al exportar PDF:', error);
            Swal.fire({
                title: 'No se pudo generar el PDF',
                text: 'Intenta nuevamente. Si persiste, recarga la página.',
                icon: 'error',
                confirmButtonColor: '#d33',
                confirmButtonText: 'Aceptar'
            });
        }
    }

    // Prepara dataset integral que alimenta la plantilla HTML del PDF.
    async function buildMonthlyPdfData(year, monthNo, logoBase64 = null) {
        const monthName = MONTHS[monthNo - 1] || String(monthNo);

        const monthlyPayments = reportsData.payments.filter(p => Number(p.year) === year && monthNameToNumber(p.month) === monthNo);
        const monthlyExpenses = reportsData.expenses.filter(exp => {
            if (!exp.expense_date) return false;
            const d = new Date(exp.expense_date);
            return d.getFullYear() === year && (d.getMonth() + 1) === monthNo;
        });

        const monthlyIncidents = reportsData.incidents.filter(inc => {
            const amount = Number(inc.cost || 0);
            if (amount <= 0) return false;

            const baseDate = inc.completed_at || inc.created_at;
            if (!baseDate) return false;

            const d = new Date(baseDate);
            return d.getFullYear() === year && (d.getMonth() + 1) === monthNo;
        });

        const matchingQuotas = reportsData.quotas.filter(q => Number(q.year) === year && monthNameToNumber(q.month) === monthNo);
        const defaultQuotaAmount = matchingQuotas.length
            ? Number(matchingQuotas[matchingQuotas.length - 1].amount || 0)
            : 0;

        const paymentByDepartment = {};
        monthlyPayments.forEach(payment => {
            const depId = Number(payment.dep_id);
            if (!depId) return;

            if (!paymentByDepartment[depId]) {
                paymentByDepartment[depId] = {
                    amountPaid: 0,
                    amountExpected: 0,
                    paidAt: null
                };
            }

            paymentByDepartment[depId].amountPaid += Number(payment.amount_paid || 0);
            paymentByDepartment[depId].amountExpected = Math.max(
                paymentByDepartment[depId].amountExpected,
                Number(payment.amount_expected || 0)
            );

            const paidAt = payment.created_at ? new Date(payment.created_at) : null;
            const currentPaidAt = paymentByDepartment[depId].paidAt ? new Date(paymentByDepartment[depId].paidAt) : null;
            if (paidAt && (!currentPaidAt || paidAt > currentPaidAt)) {
                paymentByDepartment[depId].paidAt = payment.created_at;
            }
        });

        const departments = reportsData.departments.map(dep => {
            const depId = Number(dep.id);
            const payment = paymentByDepartment[depId] || { amountPaid: 0, amountExpected: 0, paidAt: null };
            const expected = payment.amountExpected > 0 ? payment.amountExpected : defaultQuotaAmount;
            const paidAmount = round2(payment.amountPaid);
            const isPartial = paidAmount > 0 && expected > 0 && paidAmount < expected;
            const paid = expected > 0 ? paidAmount >= expected : paidAmount > 0;

            return {
                depId,
                depName: dep.name || `DEP ${depId}`,
                amountPaid: paidAmount,
                amountExpected: round2(expected),
                paid,
                isPartial,
                paidAt: payment.paidAt || null
            };
        });

        const totalIncome = round2(monthlyPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0));
        const totalExpenses = round2(monthlyExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0));
        const totalIncidentCosts = round2(monthlyIncidents.reduce((sum, inc) => sum + Number(inc.cost || 0), 0));
        const totalExpected = round2(departments.reduce((sum, dep) => sum + Number(dep.amountExpected || 0), 0));

        const expenses = [
            ...monthlyExpenses.map(exp => ({
                date: formatDateForReport(exp.expense_date),
                sortDate: parseDateKey(exp.expense_date),
                concept: exp.description || `Gasto #${exp.id}`,
                amount: round2(exp.amount)
            })),
            ...monthlyIncidents.map(inc => ({
                date: formatDateForReport(inc.completed_at || inc.created_at),
                sortDate: parseDateKey(inc.completed_at || inc.created_at),
                concept: `Incidencia resuelta${getIncidentTypeName(inc.type_id) ? `: ${getIncidentTypeName(inc.type_id)}` : ''}`,
                amount: round2(inc.cost)
            }))
        ]
            .sort((a, b) => a.sortDate - b.sortDate)
            .map(({ sortDate, ...item }) => item);

        return {
            month: monthName,
            year,
            condominioName: getNamedValue(['condominioName', 'condominio', 'residentialName', 'residencialNombre']) || 'Condominio ADI',
            towerName: 'Torre M',
            logoBase64,
            totalIncome,
            totalExpenses,
            totalIncidentCosts,
            totalExpected,
            activeDepts: departments.length,
            departments,
            expenses
        };
    }

    // Carga logo institucional y lo serializa como data URL.
    async function loadLogoBase64(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) return null;

            const blob = await response.blob();
            return await blobToDataURL(blob);
        } catch {
            return null;
        }
    }

    // Convierte Blob a cadena base64 utilizable en img src.
    function blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result || null);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // Obtiene metadatos nominales desde storage segun prioridad de llaves.
    function getNamedValue(keys) {
        for (const key of keys) {
            const localValue = localStorage.getItem(key);
            if (localValue) return localValue;
            const sessionValue = sessionStorage.getItem(key);
            if (sessionValue) return sessionValue;
        }
        return '';
    }

    // Formatea fecha de detalle para secciones tabulares del PDF.
    function formatDateForReport(dateText) {
        if (!dateText) return '—';
        const d = new Date(dateText);
        if (Number.isNaN(d.getTime())) return String(dateText);
        return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    // Devuelve timestamp numerico para ordenar registros cronologicamente.
    function parseDateKey(dateText) {
        if (!dateText) return Number.POSITIVE_INFINITY;
        const d = new Date(dateText);
        if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
        return d.getTime();
    }

    // Genera documento HTML completo del reporte financiero mensual.
    function generateMonthlyReportHTML(data) {
        const {
            month,
            year,
            condominioName,
            towerName,
            logoBase64,
            totalIncome,
            totalExpenses,
            totalIncidentCosts,
            totalExpected,
            departments,
            expenses
        } = data;

        const totalEgresos = totalExpenses + totalIncidentCosts;
        const netFlow = totalIncome - totalEgresos;

        const paidCount = departments.filter(d => d.paid && !d.isPartial).length;
        const partialCount = departments.filter(d => d.isPartial).length;
        const unpaidCount = departments.filter(d => !d.paid).length;

        const totalPending =
            departments.filter(d => !d.paid).reduce((s, d) => s + d.amountExpected, 0) +
            departments.filter(d => d.isPartial).reduce((s, d) => s + (d.amountExpected - d.amountPaid), 0);

        const collectionRate = totalExpected > 0
            ? Math.min(Math.round((totalIncome / totalExpected) * 100), 100)
            : 0;

        const sortedDepartments = [...departments].sort((a, b) => {
            const score = d => (d.paid && !d.isPartial ? 0 : d.isPartial ? 1 : 2);
            return score(a) - score(b) || String(a.depName || '').localeCompare(String(b.depName || ''), 'es');
        });

        const deptRows = sortedDepartments.map((d, index) => {
            const isEven = index % 2 === 0;
            const diff = d.amountPaid - d.amountExpected;

            let estadoStyle = '';
            let estadoLabel = '';

            if (d.isPartial) {
                estadoStyle = 'font-size:9px;font-weight:700;color:#92400E;background:#FFFBEB;padding:2px 8px;border-radius:3px;border:1px solid #FDE68A;';
                estadoLabel = 'PARCIAL';
            } else if (d.paid) {
                estadoStyle = 'font-size:9px;font-weight:700;color:#2d6a2d;background:#eaf4ea;padding:2px 8px;border-radius:3px;border:1px solid #b7d9b7;';
                estadoLabel = 'PAGADO';
            } else {
                estadoStyle = 'font-size:9px;font-weight:700;color:#b91c1c;background:#fef2f2;padding:2px 8px;border-radius:3px;border:1px solid #fecaca;';
                estadoLabel = 'PENDIENTE';
            }

            const montoColor = d.paid ? (d.isPartial ? '#92400E' : '#2d6a2d') : '#b91c1c';

            let difText = '';
            let difColor = '#1a1a1a';
            if (!d.paid) {
                difText = fmtCurrency(-d.amountExpected);
                difColor = '#b91c1c';
            } else if (d.isPartial) {
                difText = fmtCurrency(diff);
                difColor = '#92400E';
            } else {
                difText = diff !== 0 ? (diff > 0 ? `+${fmtCurrency(diff)}` : fmtCurrency(diff)) : '/';
                difColor = diff !== 0 ? (diff > 0 ? '#2d6a2d' : '#b91c1c') : '#555555';
            }

            return `
                <tr style="background:${isEven ? '#ffffff' : '#f9f9f9'};">
                    <td style="padding:7px 12px;border-bottom:1px solid #e8e8e8;font-size:11px;font-weight:700;">${escapeHtml(d.depName)}</td>
                    <td style="padding:7px 12px;border-bottom:1px solid #e8e8e8;text-align:right;font-size:11px;">${d.amountExpected > 0 ? fmtCurrency(d.amountExpected) : '—'}</td>
                    <td style="padding:7px 12px;border-bottom:1px solid #e8e8e8;text-align:right;font-size:11px;font-weight:700;color:${montoColor};">${d.paid ? fmtCurrency(d.amountPaid) : '—'}</td>
                    <td style="padding:7px 12px;border-bottom:1px solid #e8e8e8;text-align:center;font-size:10px;color:#555;">${fmtReportDate(d.paidAt)}</td>
                    <td style="padding:7px 12px;border-bottom:1px solid #e8e8e8;text-align:center;"><span style="${estadoStyle}">${estadoLabel}</span></td>
                    <td style="padding:7px 12px;border-bottom:1px solid #e8e8e8;text-align:right;font-size:11px;color:${difColor};">${difText}</td>
                </tr>`;
        }).join('');

        const deptTotalRow = `
            <tr style="background:#f0f0f0;border-top:2px solid #1a1a1a;">
                <td style="padding:8px 12px;font-size:11px;font-weight:700;">TOTAL (${departments.length} deptos)</td>
                <td style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;">${totalExpected > 0 ? fmtCurrency(totalExpected) : '—'}</td>
                <td style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;color:#2d6a2d;">${fmtCurrency(totalIncome)}</td>
                <td colspan="2" style="padding:8px 12px;text-align:center;font-size:10px;color:#555;">${paidCount} pagados · ${partialCount > 0 ? `${partialCount} parciales · ` : ''}${unpaidCount} pendientes</td>
                <td style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;color:#b91c1c;">${totalPending > 0 ? fmtCurrency(-totalPending) : '/'}</td>
            </tr>`;

        const expenseRows = expenses.map((e, index) => {
            const isEven = index % 2 === 0;
            return `
                <tr style="background:${isEven ? '#ffffff' : '#f9f9f9'};">
                    <td style="padding:7px 12px;border-bottom:1px solid #e8e8e8;font-size:11px;color:#555;">${escapeHtml(e.date)}</td>
                    <td style="padding:7px 12px;border-bottom:1px solid #e8e8e8;font-size:11px;">${escapeHtml(e.concept)}</td>
                    <td style="padding:7px 12px;border-bottom:1px solid #e8e8e8;text-align:right;font-size:11px;font-weight:700;color:#b91c1c;">${fmtCurrency(e.amount)}</td>
                </tr>`;
        }).join('');

        const expenseTotalRow = `
            <tr style="background:#f0f0f0;border-top:2px solid #1a1a1a;">
                <td colspan="2" style="padding:8px 12px;font-size:11px;font-weight:700;">TOTAL DE EGRESOS</td>
                <td style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;color:#b91c1c;">${fmtCurrency(totalEgresos)}</td>
            </tr>`;

        return `
            <style>
                .pdf-report-root * { margin: 0; padding: 0; box-sizing: border-box; }
                .pdf-report-root {
                    font-family: Helvetica, Arial, sans-serif;
                    font-size: 12px;
                    color: #1a1a1a;
                    background: #ffffff;
                    padding: 36px 44px 52px;
                }
                .pdf-divider-thick  { height:2px; background:#1a1a1a; margin:10px 0 0; }
                .pdf-divider-thin   { height:1px; background:#1a1a1a; margin:0; }
                .pdf-section-heading {
                    text-align: center;
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 1.5px;
                    text-transform: uppercase;
                    color: #1a1a1a;
                    margin: 26px 0 10px;
                    padding-bottom: 6px;
                    border-bottom: 1.5px solid #1a1a1a;
                }
                .pdf-summary-table {
                    width: 62%;
                    margin: 0 auto;
                    border-collapse: collapse;
                }
                .pdf-summary-table td {
                    padding: 5px 14px;
                    font-size: 11px;
                }
                .pdf-summary-table td:last-child { text-align: right; }
                .pdf-summary-table .pdf-total-row td {
                    font-weight: 700;
                    border-top: 1px solid #d0d0d0;
                    padding-top: 8px;
                }
                .pdf-data-table { width:100%; border-collapse:collapse; border:1px solid #d0d0d0; }
                .pdf-data-table thead th {
                    background: #1a1a1a;
                    color: #ffffff;
                    padding: 8px 12px;
                    font-size: 10px;
                    font-weight: 700;
                    letter-spacing: 0.8px;
                    text-transform: uppercase;
                    text-align: left;
                }
                .pdf-data-table thead th.right { text-align: right; }
                .pdf-data-table thead th.center { text-align: center; }
                .pdf-footer-note {
                    margin-top: 40px;
                    border-top: 1px solid #cccccc;
                    padding-top: 12px;
                    font-size: 9px;
                    color: #888888;
                    text-align: center;
                    font-style: italic;
                    line-height: 1.7;
                }
            </style>

            <div class="pdf-report-root">
                <table style="width:100%;border-collapse:collapse;">
                    <tr>
                        <td style="vertical-align:middle;width:72px;">
                            ${logoBase64
                                ? `<img src="${logoBase64}" alt="Logo" style="width:64px;height:64px;object-fit:contain;display:block;"/>`
                                : '<div style="width:64px;height:64px;border-radius:50%;background:#1a1a1a;font-size:18px;font-weight:900;color:#fff;text-align:center;line-height:64px;letter-spacing:1px;">ADI</div>'
                            }
                        </td>
                        <td style="vertical-align:middle;padding-left:14px;">
                            <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#888;margin-bottom:2px;">Reporte financiero mensual</div>
                            <div style="font-size:16px;font-weight:800;color:#1a1a1a;line-height:1.2;">${escapeHtml(towerName)}, ${escapeHtml(condominioName)}</div>
                            <div style="font-size:13px;font-weight:700;color:#1a1a1a;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">Mes de ${escapeHtml(month)} ${year}</div>
                        </td>
                    </tr>
                </table>

                <div class="pdf-divider-thick"></div>
                <div class="pdf-divider-thin" style="margin-top:2px;"></div>

                <div class="pdf-section-heading">Resumen del estado financiero</div>

                <table class="pdf-summary-table">
                    <tr><td style="color:#555;">Total de ingresos (cuotas cobradas):</td><td>${fmtCurrency(totalIncome)}</td></tr>
                    <tr><td style="color:#555;">Total de egresos:</td><td>${fmtCurrency(totalEgresos)}</td></tr>
                    ${totalIncidentCosts > 0 ? `
                        <tr><td style="color:#555;padding-left:24px;">— Gastos operativos:</td><td style="color:#555;">${fmtCurrency(totalExpenses)}</td></tr>
                        <tr><td style="color:#555;padding-left:24px;">— Costos por incidencias:</td><td style="color:#555;">${fmtCurrency(totalIncidentCosts)}</td></tr>
                    ` : ''}
                    <tr class="pdf-total-row">
                        <td>Balance del mes:</td>
                        <td style="color:${netFlow >= 0 ? '#1a1a1a' : '#b91c1c'};"><strong>${netFlow >= 0 ? '+' : ''}${fmtCurrency(netFlow)}</strong></td>
                    </tr>
                </table>

                <div class="pdf-section-heading">Detalle de ingresos — Cuotas de ${escapeHtml(month)} ${year}</div>

                <table class="pdf-summary-table">
                    <tr><td style="color:#555;">Departamentos con pago completo:</td><td style="color:#2d6a2d;font-weight:700;">${paidCount}</td></tr>
                    ${partialCount > 0 ? `
                        <tr><td style="color:#555;">Departamentos con pago parcial:</td><td style="color:#92400E;font-weight:700;">${partialCount}</td></tr>
                    ` : ''}
                    <tr><td style="color:#555;">Departamentos con pago pendiente:</td><td style="color:${unpaidCount > 0 ? '#b91c1c' : '#2d6a2d'};font-weight:700;">${unpaidCount}</td></tr>
                    ${totalExpected > 0 ? `
                        <tr><td style="color:#555;">Tasa de cobranza del mes:</td><td style="font-weight:700;color:${collectionRate >= 80 ? '#2d6a2d' : '#b91c1c'};">${collectionRate}%</td></tr>
                    ` : ''}
                    <tr class="pdf-total-row"><td>TOTAL COBRADO:</td><td><strong>${fmtCurrency(totalIncome)}</strong></td></tr>
                    ${totalPending > 0 ? `
                        <tr><td style="color:#b91c1c;">Monto pendiente por cobrar:</td><td style="font-weight:700;color:#b91c1c;">${fmtCurrency(totalPending)}</td></tr>
                    ` : ''}
                </table>

                <div class="pdf-section-heading">Pago de cuotas por departamento — ${escapeHtml(month)} ${year}</div>

                <table class="pdf-data-table">
                    <thead>
                        <tr>
                            <th>Depto.</th>
                            <th class="right">Cuota</th>
                            <th class="right">Pagado</th>
                            <th class="center">Fecha de pago</th>
                            <th class="center">Estado</th>
                            <th class="right">Diferencia</th>
                        </tr>
                    </thead>
                    <tbody>${deptRows}</tbody>
                    <tfoot>${deptTotalRow}</tfoot>
                </table>

                <div class="pdf-section-heading">Detalle de egresos — ${escapeHtml(month)} ${year}</div>
                ${expenses.length > 0 ? `
                    <table class="pdf-summary-table">
                        <tr><td style="color:#555;">Registros de gastos del mes:</td><td>${expenses.length}</td></tr>
                        ${totalExpenses > 0 ? `<tr><td style="color:#555;">Gastos operativos:</td><td>${fmtCurrency(totalExpenses)}</td></tr>` : ''}
                        ${totalIncidentCosts > 0 ? `<tr><td style="color:#555;">Costos de incidencias:</td><td>${fmtCurrency(totalIncidentCosts)}</td></tr>` : ''}
                        <tr class="pdf-total-row"><td>TOTAL DE EGRESOS:</td><td style="color:#b91c1c;"><strong>${fmtCurrency(totalEgresos)}</strong></td></tr>
                    </table>

                    <table class="pdf-data-table" style="margin-top:12px;">
                        <thead>
                            <tr>
                                <th style="width:110px;">Fecha</th>
                                <th>Concepto</th>
                                <th class="right" style="width:120px;">Monto</th>
                            </tr>
                        </thead>
                        <tbody>${expenseRows}</tbody>
                        <tfoot>${expenseTotalRow}</tfoot>
                    </table>
                ` : '<p style="text-align:center;color:#888;font-size:11px;margin:12px 0;">Sin egresos registrados para este mes.</p>'}

                <div style="margin-top:52px;">
                    <table style="width:100%;border-collapse:collapse;">
                        <tr>
                            <td style="width:33%;text-align:center;padding-top:40px;border-top:1px solid #1a1a1a;font-size:10px;color:#555;">Administrador(a) del condominio</td>
                            <td style="width:34%;"></td>
                            <td style="width:33%;text-align:center;padding-top:40px;border-top:1px solid #1a1a1a;font-size:10px;color:#555;">Presidente del Comite de Vigilancia</td>
                        </tr>
                    </table>
                </div>

                <div class="pdf-footer-note">
                    Los ingresos y egresos estan basados en los movimientos registrados en la aplicacion ADI.<br/>
                    Los pagos realizados fuera del periodo de ${escapeHtml(month)} se reflejaran en el reporte correspondiente.<br/>
                    Documento generado automaticamente · ${escapeHtml(towerName)}, ${escapeHtml(condominioName)}
                </div>
            </div>
        `;
    }

    // Formatea montos monetarios con locale es-MX.
    function fmtCurrency(n) {
        return `$${Number(n || 0).toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    // Formatea fechas de pago para columnas de evidencia administrativa.
    function fmtReportDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    // Escapa texto para prevenir inyeccion de HTML en contenido dinamico.
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});
