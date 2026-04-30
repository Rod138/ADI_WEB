/**
 * TESINA: Controlador del modulo de contabilidad.
 * Responsabilidad: gastos, cuotas, pagos, comprobantes y reportes.
 * Flujo: validar entradas -> consultar/persistir en Supabase -> responder JSON.
 */

import supabase from '../dbconfig.js';
import {
    notifyNewExpense,
    notifyQuotaPublished,
    notifyNewReceipt,
    notifyQuotaValidated,
    notifyQuotaRejected
} from '../utils/notificationSender.js';

const parseSessionUserId = (req) => {
    const raw = req.get('x-session-user-id') || req.cookies?.session_user_id;
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
};

const EXPENSE_EDIT_WINDOW_HOURS = 24;

const isExpenseWithinWindow = (expenseDate) => {
    const created = new Date(expenseDate);
    if (Number.isNaN(created.getTime())) return false;
    const diffHours = (Date.now() - created.getTime()) / (1000 * 60 * 60);
    return diffHours < EXPENSE_EDIT_WINDOW_HOURS;
};

const validateExpensePayload = ({ description, amount, image_data, expense_date, requireImage = true }) => {
    const descriptionText = String(description || '').trim();
    if (!descriptionText) {
        return 'La descripcion es obligatoria.';
    }
    if (descriptionText.length < 3) {
        return 'La descripcion debe tener al menos 3 caracteres.';
    }
    if (descriptionText.length > 150) {
        return 'La descripcion no puede pasar de 150 caracteres.';
    }

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return 'El costo debe ser mayor a 0.';
    }

    const imageText = String(image_data || '').trim();
    if (requireImage) {
        const isDataImage = /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(imageText);
        const isHttpImage = /^https?:\/\//i.test(imageText);
        if (!isDataImage && !isHttpImage) {
            return 'La imagen debe ser un archivo de imagen valido.';
        }
    }

    if (expense_date !== undefined && expense_date !== null && String(expense_date).trim()) {
        const parsedDate = new Date(expense_date);
        if (Number.isNaN(parsedDate.getTime())) {
            return 'La fecha del gasto es invalida.';
        }
    }

    return null;
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
        const validationError = validateExpensePayload({ description, amount, image_data, expense_date });
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const descriptionText = String(description).trim();
        const parsedAmount = parseFloat(amount);
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

        // Enviar notificación de nuevo gasto a todos los residentes
        try {
            await notifyNewExpense({
                description: descriptionText,
                amount: parsedAmount
            });
        } catch (notifError) {
            console.error('Error enviando notificación de gasto:', notifError.message);
        }

        return res.status(201).json({ success: true, message: 'Gasto registrado correctamente.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno al registrar el gasto.' });
    }
};

// Actualiza un gasto dentro de la ventana permitida.
export const updateTowerExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const { description, amount, image_data } = req.body;

        const { data: expense, error: fetchError } = await supabase
            .from('tower_expenses')
            .select('id, expense_date')
            .eq('id', id)
            .single();

        if (fetchError || !expense) {
            return res.status(404).json({ success: false, message: 'Gasto no encontrado.' });
        }

        if (!isExpenseWithinWindow(expense.expense_date)) {
            return res.status(403).json({ success: false, message: 'El gasto ya no puede editarse porque excedio las 24 horas.' });
        }

        const validationError = validateExpensePayload({
            description,
            amount,
            image_data,
            expense_date: expense.expense_date,
            requireImage: true
        });
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const updates = {
            description: String(description).trim(),
            amount: parseFloat(amount),
            url_image: String(image_data).trim()
        };

        const { error } = await supabase
            .from('tower_expenses')
            .update(updates)
            .eq('id', id);

        if (error) {
            return res.status(500).json({ success: false, message: 'No se pudo actualizar el gasto.' });
        }

        return res.status(200).json({ success: true, message: 'Gasto actualizado correctamente.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno al actualizar el gasto.' });
    }
};

// Elimina un gasto dentro de la ventana permitida.
export const deleteTowerExpense = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: expense, error: fetchError } = await supabase
            .from('tower_expenses')
            .select('id, expense_date')
            .eq('id', id)
            .single();

        if (fetchError || !expense) {
            return res.status(404).json({ success: false, message: 'Gasto no encontrado.' });
        }

        if (!isExpenseWithinWindow(expense.expense_date)) {
            return res.status(403).json({ success: false, message: 'El gasto ya no puede borrarse porque excedio las 24 horas.' });
        }

        const { error } = await supabase
            .from('tower_expenses')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(500).json({ success: false, message: 'No se pudo eliminar el gasto.' });
        }

        return res.status(200).json({ success: true, message: 'Gasto eliminado correctamente.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno al eliminar el gasto.' });
    }
};

// Obtiene gastos de condominio para mostrarlos en un tablon con filtros en frontend.
export const getTowerExpensesBoard = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tower_expenses')
            .select('id, description, url_image, amount, expense_date')
            .order('expense_date', { ascending: false });

        if (error) {
            return res.status(500).json({ success: false, message: 'No se pudieron obtener los gastos.' });
        }

        return res.status(200).json({
            success: true,
            expenses: data || []
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno al consultar gastos.' });
    }
};

// === Unified Finance Configuration ===
// Calculates the current tower balance: initial_fund + payments_received - expenses
const calculateTowerBalance = async () => {
    try {
        // Get current fund
        const { data: fundData, error: fundError } = await supabase
            .from('tower_fund')
            .select('initial_amount')
            .order('updated_at', { ascending: false })
            .limit(1);

        const initialAmount = fundData && fundData.length > 0 ? parseFloat(fundData[0].initial_amount || 0) : 0;

        // Get total payments received from departments
        const { data: paymentsData, error: paymentsError } = await supabase
            .from('recipes_payment')
            .select('amount_paid');

        const totalPayments = paymentsData
            ? paymentsData.reduce((sum, p) => sum + (parseFloat(p.amount_paid || 0)), 0)
            : 0;

        // Get total expenses
        const { data: expensesData, error: expensesError } = await supabase
            .from('tower_expenses')
            .select('amount');

        const totalExpenses = expensesData
            ? expensesData.reduce((sum, e) => sum + (parseFloat(e.amount || 0)), 0)
            : 0;

        const balance = initialAmount + totalPayments - totalExpenses;
        return { balance, initialAmount, totalPayments, totalExpenses };
    } catch (error) {
        console.error('Error calculating balance:', error);
        return { balance: 0, initialAmount: 0, totalPayments: 0, totalExpenses: 0 };
    }
};

// Obtiene la configuracion vigente del fondo inicial de torre.
// Retrieves both tower fund and monthly quota configurations
export const getFinanceConfig = async (req, res) => {
    try {
        const { data: fundData, error: fundError } = await supabase
            .from('tower_fund')
            .select('id, initial_amount, updated_at')
            .order('updated_at', { ascending: false })
            .limit(1);

        const { data: quotaData, error: quotaError } = await supabase
            .from('monthly_quota')
            .select('id, month, year, amount, created_at')
            .order('year', { ascending: false })
            .order('created_at', { ascending: false });

        if (fundError || quotaError) {
            return res.status(500).json({ success: false, message: 'No se pudo obtener la configuración financiera.' });
        }

        const currentFund = Array.isArray(fundData) && fundData.length > 0 ? fundData[0] : null;
        const balanceData = await calculateTowerBalance();

        return res.status(200).json({
            success: true,
            fund: currentFund,
            quotas: quotaData || [],
            balance: balanceData
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno al consultar configuración financiera.' });
    }
};

// Updates both tower fund and monthly quota configurations
export const upsertFinanceConfig = async (req, res) => {
    try {
        const { initial_amount, month, year, amount } = req.body;
        const nowIso = new Date().toISOString();

        // Update tower fund if initial_amount is provided
        if (initial_amount !== undefined && initial_amount !== null) {
            const parsedAmount = parseFloat(initial_amount);
            if (isNaN(parsedAmount) || parsedAmount < 0) {
                return res.status(400).json({ success: false, message: 'El fondo inicial debe ser un número mayor o igual a 0.' });
            }

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
        }

        // Update monthly quota if month, year, amount are provided
        if (month !== undefined && year !== undefined && amount !== undefined) {
            const normalizedMonth = String(month || '').trim();
            const yearNum = parseInt(year, 10);
            const amountNum = parseFloat(amount);

            if (!normalizedMonth) {
                return res.status(400).json({ success: false, message: 'El mes es obligatorio.' });
            }

            if (isNaN(yearNum) || yearNum < 2000) {
                return res.status(400).json({ success: false, message: 'El año es inválido.' });
            }

            if (isNaN(amountNum) || amountNum <= 0) {
                return res.status(400).json({ success: false, message: 'La cuota debe ser mayor a 0.' });
            }

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

            // Enviar notificación de cuota publicada si se creó una nueva
            if (!existing) {
                try {
                    await notifyQuotaPublished({
                        month: normalizedMonth,
                        year: yearNum,
                        amount: amountNum
                    });
                } catch (notifError) {
                    console.error('Error enviando notificación de cuota:', notifError.message);
                }
            }
        }

        return res.status(200).json({ success: true, message: 'Configuración financiera actualizada correctamente.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno al guardar configuración financiera.' });
    }
};

// === Legacy function aliases (for backward compatibility) ===
export const getTowerFundConfig = getFinanceConfig;
export const upsertTowerFundConfig = upsertFinanceConfig;
export const getMonthlyQuotaConfig = getFinanceConfig;
export const upsertMonthlyQuotaConfig = upsertFinanceConfig;

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
        // Obtener datos del comprobante antes de actualizar
        const { data: receipt, error: fetchError } = await supabase
            .from('recipes_payment')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !receipt) {
            return res.status(404).json({ success: false, message: 'Comprobante no encontrado.' });
        }

        const { error } = await supabase
            .from('recipes_payment')
            .update({ validated })
            .eq('id', id);

        if (error) {
            return res.status(500).json({ success: false, message: 'No se pudo actualizar el comprobante.' });
        }

        // Enviar notificación de validación o rechazo
        try {
            if (validated === true) {
                // Notificación de aprobación
                await notifyQuotaValidated({
                    depId: receipt.dep_id,
                    month: receipt.month,
                    year: receipt.year,
                    amountPaid: receipt.amount_paid
                });
            } else if (validated === false) {
                // Notificación de rechazo
                await notifyQuotaRejected({
                    depId: receipt.dep_id,
                    month: receipt.month,
                    year: receipt.year
                });
            }
        } catch (notifError) {
            console.error('Error enviando notificación de validación:', notifError.message);
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
        const { dep_id, year, month, amount_paid, amount_expected, url_image, is_cash } = req.body;
        const sessionUser = await getSessionUser(req);
        const isManager = Number(sessionUser?.rol_id || 0) >= 2;
        const isCashPayment = isManager && is_cash === true;

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

        if (!isCashPayment && (!url_image || !String(url_image).trim())) {
            return res.status(400).json({ success: false, message: 'Debes adjuntar el comprobante de pago.' });
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
                url_image: isCashPayment ? null : String(url_image).trim(),
                validated: isCashPayment ? true : null,
                created_at: new Date().toISOString()
            });

        if (error) {
            return res.status(500).json({ success: false, message: 'No se pudo registrar el pago.' });
        }

        // Enviar notificación de nuevo comprobante a tesoreros
        try {
            const { data: deptData } = await supabase
                .from('departments')
                .select('name')
                .eq('id', depIdNum)
                .single();

            const depName = deptData?.name || `DEP ${depIdNum}`;

            await notifyNewReceipt({
                depName,
                month: normalizedMonth,
                year: yearNum,
                amountPaid: amountPaidNum
            });
        } catch (notifError) {
            console.error('Error enviando notificación de recibo:', notifError.message);
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
