/**
 * TESINA: Registro de gastos en el modulo contable (cliente).
 * Responsabilidad: validar formulario, previsualizar evidencia y enviar gasto.
 * Dato clave: la evidencia se codifica en base64 para su almacenamiento.
 */

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

    if (!amountInput || !notesInput || !imageInput || !confirmInput || !saveBtn) return;

    let imageData = '';

    notesInput.addEventListener('input', () => {
        charCounter.textContent = `${notesInput.value.length} / 150`;
    });

    // Estandariza la fecha para conservar trazabilidad en el registro.
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

        if (!file.type || !file.type.startsWith('image/')) {
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
                    text: 'Ingresa un costo numérico mayor a 0.',
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
                const response = await fetch('/api/accounting/expenses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: parsedAmount,
                        description,
                        image_data: imageData,
                        expense_date: getCurrentIsoDate()
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

                window.location.href = '/accounting';
            } catch {
                Swal.fire({
                    title: 'Error de conexión',
                    text: 'No se pudo guardar el gasto.',
                    icon: 'error',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Aceptar'
                });
            }
        }, { loadingText: 'ENVIANDO...' });
    });
});
