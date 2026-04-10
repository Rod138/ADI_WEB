document.addEventListener('DOMContentLoaded', async () => {
    const typeSelect = document.getElementById('report-type');
    const yearSelect = document.getElementById('report-year');
    const monthSelect = document.getElementById('report-month');
    const viewSelect = document.getElementById('report-view');
    const chartWrap = document.getElementById('chart-wrap');
    const tableWrap = document.getElementById('table-wrap');
    const emptyState = document.getElementById('reports-empty-state');
    const head = document.getElementById('reports-head');
    const body = document.getElementById('reports-body');
    const downloadBtn = document.getElementById('download-report-btn');

    const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    let chart = null;
    let lastRenderedRows = [];
    let lastRenderedHeaders = [];

    let reportsData = {
        payments: [],
        expenses: [],
        quotas: [],
        departments: [],
        incidents: []
    };

    monthSelect.innerHTML += MONTHS.map((m, idx) => `<option value="${idx + 1}">${m}</option>`).join('');

    try {
        const response = await fetch('/api/accounting/reports-data');
        const data = await response.json();

        if (!data.success) {
            Swal.fire({ icon: 'error', title: 'Error', text: data.message || 'No se pudieron cargar los reportes.' });
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

        populateYears();
        applyDefaultFilters();
        syncMonthFilterRules();
        render();
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Fallo de red al cargar reportes.' });
        return;
    }

    [typeSelect, yearSelect, monthSelect, viewSelect].forEach(el => {
        el.addEventListener('change', () => {
            syncMonthFilterRules();
            render();
        });
    });

    downloadBtn.addEventListener('click', () => {
        if (viewSelect.value === 'chart' && chart) {
            const canvas = document.getElementById('reports-chart');
            const url = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = url;
            link.download = `${typeSelect.value}_reporte.png`;
            link.click();
        } else {
            if (!lastRenderedRows.length) {
                Swal.fire({ icon: 'info', title: 'Sin datos', text: 'No hay datos para descargar.' });
                return;
            }

            if (typeof html2canvas === 'undefined') {
                Swal.fire({ icon: 'warning', title: 'No disponible', text: 'Descarga de tabla como PNG no está disponible.' });
                return;
            }

            const table = document.getElementById('reports-table');
            html2canvas(table).then(canvas => {
                const url = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = url;
                link.download = 'reporte_pagos.png';
                link.click();
            });
        }
    });

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

    function applyDefaultFilters() {
        const now = new Date();
        typeSelect.value = 'payments';
        viewSelect.value = 'table';
        monthSelect.value = String(now.getMonth() + 1);

        const currentYear = String(now.getFullYear());
        const yearOptionExists = [...yearSelect.options].some(o => o.value === currentYear);
        yearSelect.value = yearOptionExists ? currentYear : (yearSelect.options[0]?.value || currentYear);
    }

    function syncMonthFilterRules() {
        const lockAnyMonth = typeSelect.value === 'payments' && viewSelect.value === 'table';
        const anyMonthOption = monthSelect.querySelector('option[value="any"]');
        if (!anyMonthOption) return;

        anyMonthOption.hidden = lockAnyMonth;
        if (lockAnyMonth && monthSelect.value === 'any') {
            monthSelect.value = String(new Date().getMonth() + 1);
        }
    }

    function render() {
        hideEmptyState();
        const mode = viewSelect.value;
        const type = typeSelect.value;
        const selectedYear = yearSelect.value;
        const selectedMonth = monthSelect.value;

        if (mode === 'chart') {
            chartWrap.style.display = 'block';
            tableWrap.style.display = 'none';
            renderChart(type, selectedYear, selectedMonth);
        } else {
            chartWrap.style.display = 'none';
            tableWrap.style.display = 'block';
            renderTable(type, selectedYear, selectedMonth);
        }
    }

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
                    data: rows.map(r => round2(r.payments - r.expenses)),
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
                chartWrap.style.display = 'none';
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
            chartWrap.style.display = 'none';
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
    }

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
            tableWrap.style.display = 'none';
            showEmptyState('Sin datos para el mes y año seleccionados.');
            head.innerHTML = '';
            body.innerHTML = '';
            lastRenderedHeaders = [];
            lastRenderedRows = [];
        } else {
            body.innerHTML = renderedRows.map(row => buildStyledRow(row, type)).join('');
            lastRenderedHeaders = headers;
            lastRenderedRows = renderedRows;
        }
    }

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

    function parsePeriodLabel(label) {
        const parts = String(label).split(' ');
        const monthName = (parts[0] || '').toLowerCase();
        const year = Number(parts[1] || 0);
        const month = monthNameToNumber(monthName) || 1;
        return year * 100 + month;
    }

    function getIncidentTypeName(typeId) {
        const incidentType = reportsData.incidentTypes.find(item => String(item.id) === String(typeId));
        return incidentType?.name || incidentType?.type || `Tipo #${typeId ?? '-'}`;
    }

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

    function getNextPeriodKey(year, month) {
        const date = new Date(year, month - 1, 1);
        date.setMonth(date.getMonth() + 1);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    function showEmptyState(message) {
        emptyState.textContent = message;
        emptyState.style.display = 'flex';
    }

    function hideEmptyState() {
        emptyState.style.display = 'none';
        emptyState.textContent = '';
    }

    function emptyPeriod(key) {
        return {
            period: key,
            payments: 0,
            expenses: 0,
            expected: 0,
            records: 0
        };
    }

    function formatSigned(value) {
        const number = round2(value);
        if (number > 0) return `+ ${number}`;
        if (number < 0) return `- ${Math.abs(number)}`;
        return '0';
    }

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

    function formatPeriodLabel(periodKey) {
        const [y, m] = String(periodKey).split('-');
        const monthName = MONTHS[Number(m) - 1] || m;
        return `${monthName} ${y}`;
    }

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

    function round2(value) {
        return Math.round(Number(value || 0) * 100) / 100;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});
