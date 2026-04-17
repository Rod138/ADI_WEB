/**
 * TESINA: Controlador del modulo de contabilidad.
 * Responsabilidad: gastos, cuotas, pagos, comprobantes y reportes.
 * Flujo: validar entradas -> consultar/persistir en Supabase -> responder JSON.
 */

import supabase from '../dbconfig.js';

const parseSessionUserId = (req) => {
    const raw = req.get('x-session-user-id') || req.cookies?.session_user_id;
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
};

const getSessionUser = async (req) => {
    const userId = parseSessionUserId(req);
    if (!userId) return null;

    const { data, error } = await supabase
        .from('users')
        .select('id, rol_id, dep_id')
        .eq('id', userId)
        .single();

    if (error || !data) return null;
    return data;
};

// Registra un gasto operativo de torre con evidencia visual obligatoria.
export const createTowerExpense = async (req, res) => {
    try {
        const { description, amount, image_data, expense_date } = req.body;

        if (!description || !String(description).trim()) {
            return res.status(400).json({ success: false, message: 'La descripcion es obligatoria.' });
        }

        if (!image_data || !String(image_data).trim()) {
            return res.status(400).json({ success: false, message: 'Debes cargar una imagen.' });
        }

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ success: false, message: 'El costo debe ser mayor a 0.' });
        }

        const descriptionText = String(description).trim();
        if (descriptionText.length > 150) {
            return res.status(400).json({ success: false, message: 'La descripcion no puede pasar de 150 caracteres.' });
        }

        const expenseDateIso = expense_date ? new Date(expense_date).toISOString() : new Date().toISOString();

        const { error } = await supabase
            .from('tower_expenses')
            .insert({
                description: descriptionText,
                url_image: String(image_data).trim(),
                amount: parsedAmount,
                expense_date: expenseDateIso
            });

        if (error) {
            return res.status(500).json({ success: false, message: 'No se pudo guardar el gasto.' });
        }

        return res.status(201).json({ success: true, message: 'Gasto registrado correctamente.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno al registrar el gasto.' });
    }
};

// Obtiene la configuracion vigente del fondo inicial de torre.
export const getTowerFundConfig = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tower_fund')
            .select('id, initial_amount, updated_at')
            .order('updated_at', { ascending: false })
            .limit(1);

        if (error) {
            return res.status(500).json({ success: false, message: 'No se pudo obtener el fondo inicial.' });
        }

        const currentFund = Array.isArray(data) && data.length > 0 ? data[0] : null;

        return res.status(200).json({
            success: true,
            fund: currentFund
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno al consultar el fondo inicial.' });
    }
};

// Inserta o actualiza (upsert manual) el fondo inicial segun exista un registro previo.
export const upsertTowerFundConfig = async (req, res) => {
    const { initial_amount } = req.body;
    const parsedAmount = parseFloat(initial_amount);

    if (isNaN(parsedAmount) || parsedAmount < 0) {
        return res.status(400).json({ success: false, message: 'El fondo inicial debe ser un numero mayor o igual a 0.' });
    }

    try {
        const nowIso = new Date().toISOString();

        const { data: existingRows, error: existingError } = await supabase
            .from('tower_fund')
            .select('id')
            .order('updated_at', { ascending: false })
            .limit(1);

        if (existingError) {
            return res.status(500).json({ success: false, message: 'No se pudo validar el fondo actual.' });
        }

        const latest = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;

        let saveError = null;

        if (latest) {
            const { error } = await supabase
                .from('tower_fund')
                .update({
                    initial_amount: parsedAmount,
                    updated_at: nowIso
                })
                .eq('id', latest.id);
            saveError = error;
        } else {
            const { error } = await supabase
                .from('tower_fund')
                .insert({
                    initial_amount: parsedAmount,
                    updated_at: nowIso
                });
            saveError = error;
        }

        if (saveError) {
            return res.status(500).json({ success: false, message: 'No se pudo guardar el fondo inicial.' });
        }

        return res.status(200).json({ success: true, message: 'Fondo inicial actualizado correctamente.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno al guardar el fondo inicial.' });
    }
};

// Lista historica de configuraciones de cuota mensual para consulta administrativa.
export const getMonthlyQuotaConfig = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('monthly_quota')
            .select('id, month, year, amount, created_at')
            .order('year', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ success: false, message: 'No se pudo obtener la configuracion de cuotas.' });
        }

        return res.status(200).json({ success: true, quotas: data || [] });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno al consultar cuotas.' });
    }
};

// Crea o actualiza la cuota de un mes/anio especifico manteniendo unicidad logica.
export const upsertMonthlyQuotaConfig = async (req, res) => {
    try {
        const { month, year, amount } = req.body;

        const normalizedMonth = String(month || '').trim();
        const yearNum = parseInt(year, 10);
        const amountNum = parseFloat(amount);

        if (!normalizedMonth) {
            return res.status(400).json({ success: false, message: 'El mes es obligatorio.' });
        }

        if (isNaN(yearNum) || yearNum < 2000) {
            return res.status(400).json({ success: false, message: 'El año es invalido.' });
        }

        if (isNaN(amountNum) || amountNum <= 0) {
            return res.status(400).json({ success: false, message: 'La cuota debe ser mayor a 0.' });
        }

        const nowIso = new Date().toISOString();

        const { data: existingRows, error: existingError } = await supabase
            .from('monthly_quota')
            .select('id')
            .eq('month', normalizedMonth)
            .eq('year', yearNum)
            .limit(1);

        if (existingError) {
            return res.status(500).json({ success: false, message: 'No se pudo validar la cuota mensual.' });
        }

        const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
        let saveError = null;

        if (existing) {
            const { error } = await supabase
                .from('monthly_quota')
                .update({
                    amount: amountNum,
                    created_at: nowIso
                })
                .eq('id', existing.id);
            saveError = error;
        } else {
            const { error } = await supabase
                .from('monthly_quota')
                .insert({
                    month: normalizedMonth,
                    year: yearNum,
                    amount: amountNum,
                    created_at: nowIso
                });
            saveError = error;
        }

        if (saveError) {
            return res.status(500).json({ success: false, message: 'No se pudo guardar la cuota mensual.' });
        }

        return res.status(200).json({ success: true, message: 'Cuota mensual guardada correctamente.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno al guardar cuota mensual.' });
    }
};

// Recupera comprobantes junto con el nombre legible del departamento.
export const getPaymentReceipts = async (req, res) => {
    try {
        const [receiptsRes, departmentsRes] = await Promise.all([
            supabase
                .from('recipes_payment')
                .select('*')
                .order('created_at', { ascending: false }),
            supabase
                .from('departments')
                .select('id, name')
                .order('id', { ascending: true })
        ]);

        if (receiptsRes.error || departmentsRes.error) {
            return res.status(500).json({ success: false, message: 'Error al obtener comprobantes.' });
        }

        const departmentsMap = Object.fromEntries((departmentsRes.data || []).map(d => [d.id, d.name]));

        const receipts = (receiptsRes.data || []).map(r => ({
            ...r,
            department_name: departmentsMap[r.dep_id] || `DEP ${r.dep_id}`
        }));

        return res.status(200).json({
            success: true,
            receipts,
            departments: departmentsRes.data || []
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno.' });
    }
};

// Devuelve el detalle de un comprobante individual para su revision en pantalla.
export const getPaymentReceiptById = async (req, res) => {
    const { id } = req.params;

    try {
        const { data: receipt, error: receiptError } = await supabase
            .from('recipes_payment')
            .select('*')
            .eq('id', id)
            .single();

        if (receiptError || !receipt) {
            return res.status(404).json({ success: false, message: 'Comprobante no encontrado.' });
        }

        const { data: department } = await supabase
            .from('departments')
            .select('id, name')
            .eq('id', receipt.dep_id)
            .single();

        return res.status(200).json({
            success: true,
            receipt: {
                ...receipt,
                department_name: department?.name || `DEP ${receipt.dep_id}`
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno.' });
    }
};

// Actualiza el estado de validacion de un comprobante de pago.
export const updatePaymentReceipt = async (req, res) => {
    const { id } = req.params;
    const { validated } = req.body;

    if (typeof validated !== 'boolean') {
        return res.status(400).json({ success: false, message: 'validated debe ser booleano.' });
    }

    try {
        const { error } = await supabase
            .from('recipes_payment')
            .update({ validated })
            .eq('id', id);

        if (error) {
            return res.status(500).json({ success: false, message: 'No se pudo actualizar el comprobante.' });
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno.' });
    }
};

// Compone dataset base (departamentos, cuotas y comprobantes) para el modulo de pagos.
export const getQuotaPaymentData = async (req, res) => {
    try {
        const sessionUser = await getSessionUser(req);
        const isManager = Number(sessionUser?.rol_id || 0) >= 2;

        const [departmentsRes, quotasRes, receiptsRes] = await Promise.all([
            supabase
                .from('departments')
                .select('id, name')
                .order('id', { ascending: true }),
            supabase
                .from('monthly_quota')
                .select('*')
                .order('created_at', { ascending: false }),
            supabase
                .from('recipes_payment')
                .select('*')
                .order('created_at', { ascending: false })
        ]);

        if (departmentsRes.error || quotasRes.error || receiptsRes.error) {
            return res.status(500).json({ success: false, message: 'Error al obtener datos de pago de cuota.' });
        }

        const departmentsMap = Object.fromEntries((departmentsRes.data || []).map(d => [d.id, d.name]));
        const allReceipts = (receiptsRes.data || []).map(r => ({
            ...r,
            department_name: departmentsMap[r.dep_id] || `DEP ${r.dep_id}`
        }));

        const visibleDepartments = isManager
            ? (departmentsRes.data || [])
            : (departmentsRes.data || []).filter(d => Number(d.id) === Number(sessionUser?.dep_id));

        const visibleReceipts = isManager
            ? allReceipts
            : allReceipts.filter(r => Number(r.dep_id) === Number(sessionUser?.dep_id));

        return res.status(200).json({
            success: true,
            departments: visibleDepartments,
            quotas: quotasRes.data || [],
            receipts: visibleReceipts
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno.' });
    }
};

// Registra un pago mensual evitando duplicados por departamento, mes y anio.
export const createQuotaPayment = async (req, res) => {
    try {
        const { dep_id, year, month, amount_paid, amount_expected } = req.body;
        const sessionUser = await getSessionUser(req);
        const isManager = Number(sessionUser?.rol_id || 0) >= 2;

        const depIdNum = isManager
            ? parseInt(dep_id, 10)
            : parseInt(sessionUser?.dep_id, 10);
        const yearNum = parseInt(year, 10);
        const amountPaidNum = parseFloat(amount_paid);
        const amountExpectedNum = parseFloat(amount_expected);

        if (isNaN(depIdNum)) {
            return res.status(400).json({ success: false, message: 'Departamento invalido.' });
        }

        if (isNaN(yearNum) || yearNum < 2000) {
            return res.status(400).json({ success: false, message: 'Año inválido.' });
        }

        if (!month || !String(month).trim()) {
            return res.status(400).json({ success: false, message: 'Mes obligatorio.' });
        }

        if (isNaN(amountPaidNum) || amountPaidNum < 0) {
            return res.status(400).json({ success: false, message: 'Cantidad pagada invalida.' });
        }

        if (isNaN(amountExpectedNum) || amountExpectedNum <= 0) {
            return res.status(400).json({ success: false, message: 'Cantidad esperada invalida.' });
        }

        const normalizedMonth = String(month).trim();

        const { data: existing, error: existingError } = await supabase
            .from('recipes_payment')
            .select('id')
            .eq('dep_id', depIdNum)
            .eq('year', yearNum)
            .eq('month', normalizedMonth)
            .limit(1);

        if (existingError) {
            return res.status(500).json({ success: false, message: 'No se pudo validar el estado de pago.' });
        }

        if (existing && existing.length > 0) {
            return res.status(409).json({ success: false, message: 'Ese departamento ya tiene pago registrado para ese mes y año.' });
        }

        const { error } = await supabase
            .from('recipes_payment')
            .insert({
                dep_id: depIdNum,
                year: yearNum,
                month: normalizedMonth,
                amount_paid: amountPaidNum,
                amount_expected: amountExpectedNum,
                url_image: null,
                validated: false,
                created_at: new Date().toISOString()
            });

        if (error) {
            return res.status(500).json({ success: false, message: 'No se pudo registrar el pago.' });
        }

        return res.status(201).json({ success: true, message: 'Pago registrado correctamente.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno al registrar pago.' });
    }
};

// Consolida datos contables e incidencias para visualizaciones y reportes del frontend.
export const getAccountingReportsData = async (req, res) => {
    try {
        const [paymentsRes, expensesRes, quotasRes, departmentsRes, incidentsRes, incidentTypesRes] = await Promise.all([
            supabase
                .from('recipes_payment')
                .select('id, dep_id, year, month, amount_paid, amount_expected, created_at, validated')
                .order('created_at', { ascending: true }),
            supabase
                .from('tower_expenses')
                .select('id, amount, description, expense_date')
                .order('expense_date', { ascending: true }),
            supabase
                .from('monthly_quota')
                .select('id, month, year, amount, created_at')
                .order('created_at', { ascending: true }),
            supabase
                .from('departments')
                .select('id, name')
                .order('name', { ascending: true }),
            supabase
                .from('incidents')
                .select('*')
                .order('created_at', { ascending: true }),
            supabase
                .from('inc_types')
                .select('id, name, area_id')
                .order('id', { ascending: true })
        ]);

        if (paymentsRes.error || expensesRes.error || quotasRes.error || departmentsRes.error || incidentsRes.error || incidentTypesRes.error) {
            return res.status(500).json({ success: false, message: 'Error al obtener datos de reportes.' });
        }

        return res.status(200).json({
            success: true,
            payments: paymentsRes.data || [],
            expenses: expensesRes.data || [],
            quotas: quotasRes.data || [],
            departments: departmentsRes.data || [],
            incidents: incidentsRes.data || [],
            incidentTypes: incidentTypesRes.data || []
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno al generar reportes.' });
    }
};
