import supabase from '../dbconfig.js';

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

export const getQuotaPaymentData = async (req, res) => {
    try {
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
        const receipts = (receiptsRes.data || []).map(r => ({
            ...r,
            department_name: departmentsMap[r.dep_id] || `DEP ${r.dep_id}`
        }));

        return res.status(200).json({
            success: true,
            departments: departmentsRes.data || [],
            quotas: quotasRes.data || [],
            receipts
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error interno.' });
    }
};

export const createQuotaPayment = async (req, res) => {
    try {
        const { dep_id, year, month, amount_paid, amount_expected } = req.body;

        const depIdNum = parseInt(dep_id, 10);
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
