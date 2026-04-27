/**
 * TESINA: Funciones de validacion centralizadas para toda la aplicacion.
 * Responsabilidad: validar emails, contraseñas, nombres, telefonos con patrones consistentes.
 * Uso: importar en controladores para validar entrada de datos de usuarios.
 */

// Patrones de validación consistentes en toda la aplicación
const ValidationPatterns = {
    nameRegex: /^[a-záéíóúñA-ZÁÉÍÓÚÑ\s]{3,30}$/,
    emailRegex: /^[^\s@]{1,64}@[^\s@]{1,255}\.[a-z]{2,}$/i,
    phoneRegex: /^\d{10}$/,
    passwordRegex: /^(?=.*[a-zA-Z\d])[a-zA-Z\d@$!%*?&]{8,16}$/
};

/**
 * Sanitiza y valida un email
 * @param {string} email - Email a validar
 * @returns {string|null} Email sanitizado si es válido, null si no
 */
export const sanitizeEmail = (email) => {
    if (!email || typeof email !== 'string') {
        return null;
    }

    const emailTrimmed = String(email).trim();

    // Validar longitud: 6-320 caracteres
    if (emailTrimmed.length < 6 || emailTrimmed.length > 320) {
        return null;
    }

    // Validar formato
    if (!ValidationPatterns.emailRegex.test(emailTrimmed)) {
        return null;
    }

    return emailTrimmed;
};

/**
 * Valida una contraseña
 * @param {string} password - Contraseña a validar
 * @returns {boolean} true si la contraseña cumple con los requisitos
 */
export const validatePassword = (password) => {
    if (!password || typeof password !== 'string') {
        return false;
    }

    // Validar longitud: 8-16 caracteres
    if (password.length < 8 || password.length > 16) {
        return false;
    }

    // Validar formato: debe incluir mayúscula, minúscula y dígito
    return ValidationPatterns.passwordRegex.test(password);
};

/**
 * Valida un nombre
 * @param {string} name - Nombre a validar
 * @returns {boolean} true si el nombre cumple con los requisitos
 */
export const validateName = (name) => {
    if (!name || typeof name !== 'string') {
        return false;
    }

    return ValidationPatterns.nameRegex.test(name.trim());
};

/**
 * Valida un teléfono
 * @param {string} phone - Teléfono a validar
 * @returns {boolean} true si el teléfono cumple con los requisitos (10 dígitos)
 */
export const validatePhone = (phone) => {
    if (!phone || typeof phone !== 'string') {
        return false;
    }

    return ValidationPatterns.phoneRegex.test(phone.trim());
};

/**
 * Exporta todos los patrones para uso en cliente
 */
export { ValidationPatterns };
