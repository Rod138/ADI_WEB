document.addEventListener('DOMContentLoaded', () => {
    const amountInput = document.getElementById('expense-amount');
    const notesInput = document.getElementById('expense-notes');
    const imageInput = document.getElementById('expense-image');
    const confirmInput = document.getElementById('expense-confirm');
    const saveBtn = document.getElementById('save-expense-btn');
    const charCounter = document.getElementById('char-counter');
    const uploadIcon = document.getElementById('upload-icon');
    const uploadName = document.getElementById('upload-name');
    const previewImage = document.getElementById('preview-image');

    let imageData = '';

    notesInput.addEventListener('input', () => {
        charCounter.textContent = `${notesInput.value.length} / 150`;
    });

    const getCurrentIsoDate = () => new Date().toISOString();

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
            Swal.fire({ icon: 'error', title: 'Archivo invalido', text: 'Solo se permiten imagenes.' });
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
        const amount = amountInput.value;
        const description = notesInput.value.trim();

        if (!amount || parseFloat(amount) <= 0) {
            Swal.fire({ icon: 'warning', title: 'Costo invalido', text: 'Ingresa un costo mayor a 0.' });
            return;
        }

        if (!description) {
            Swal.fire({ icon: 'warning', title: 'Falta descripcion', text: 'Escribe una descripcion del gasto.' });
            return;
        }

        if (!imageData) {
            Swal.fire({ icon: 'warning', title: 'Falta comprobante', text: 'Selecciona la imagen del comprobante.' });
            return;
        }

        if (!confirmInput.checked) {
            Swal.fire({ icon: 'warning', title: 'Confirma el envio', text: 'Marca la casilla de confirmacion.' });
            return;
        }

        saveBtn.disabled = true;

        try {
            const response = await fetch('/api/accounting/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description,
                    amount,
                    image_data: imageData,
                    expense_date: getCurrentIsoDate()
                })
            });

            const result = await response.json();

            if (!result.success) {
                Swal.fire({ icon: 'error', title: 'Error', text: result.message || 'No se pudo registrar el gasto.' });
                return;
            }

            await Swal.fire({
                icon: 'success',
                title: 'Gasto registrado',
                text: 'El gasto se guardo correctamente.',
                timer: 1700,
                timerProgressBar: true,
                showConfirmButton: false
            });

            window.location.href = '/accounting';
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Fallo de red al guardar.' });
        } finally {
            saveBtn.disabled = false;
        }
    });
});
