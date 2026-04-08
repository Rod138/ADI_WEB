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
