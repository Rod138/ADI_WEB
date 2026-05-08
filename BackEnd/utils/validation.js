/**
 * TESINA: Funciones de validacion centralizadas para toda la aplicacion.
 * Responsabilidad: validar emails, contraseñas, nombres, telefonos con patrones consistentes.
 * Uso: importar en controladores para validar entrada de datos de usuarios.
 */

// Patrones de validación consistentes en toda la aplicación
const ValidationPatterns = {
    nameRegex: /^[a-záéíóúñA-ZÁÉÍÓÚÑ\s]{3,30}$/,
    // Local-part: letters, digits and these special chars !#$%&'*+/=?^_`{|}~-
    // Dots allowed between tokens but not at start/end or consecutively.
    // Domain: labels with letters/digits/hyphens and a TLD of at least 2 letters.
    emailRegex: /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/i,
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

/**
 * Hashea una contraseña utilizando bcryptjs
 * @param {string} password - Contraseña en texto plano
 * @returns {Promise<string>} Contraseña hasheada
 */
export const hashPassword = async (password) => {
    const bcrypt = await import('bcryptjs');
    const saltRounds = 10;
    return bcrypt.default.hash(password, saltRounds);
};

/**
 * Compara una contraseña en texto plano con su hash
 * @param {string} inputPassword - Contraseña ingresada por el usuario
 * @param {string} hashedPassword - Hash almacenado en la BD
 * @returns {Promise<boolean>} true si las contraseñas coinciden
 */
export const comparePassword = async (inputPassword, hashedPassword) => {
    const bcrypt = await import('bcryptjs');
    return bcrypt.default.compare(inputPassword, hashedPassword);
};

/**
 * Genera un JWT access token con 15 minutos de duración
 * @param {number} userId - ID del usuario
 * @param {number} userId - ID del usuario
 * @param {number|null} rolId - ID del rol del usuario
 * @param {string|null} rolName - Nombre del rol del usuario
 * @returns {Promise<string>} JWT access token
 */
export const generateAccessToken = async (userId, rolId = null, rolName = null) => {
    const { default: jwt } = await import('jsonwebtoken');
    const payload = { userId, type: 'access' };
    if (rolId !== null && rolId !== undefined) payload.rol_id = rolId;
    if (rolName !== null && rolName !== undefined) payload.rol_name = rolName;

    return jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRY || '15m' }
    );
};

/**
 * Genera un JWT refresh token con 7 días de duración
 * @param {number} userId - ID del usuario
 * @returns {Promise<string>} JWT refresh token
 */
export const generateRefreshToken = async (userId) => {
    const { default: jwt } = await import('jsonwebtoken');
    return jwt.sign(
        { userId, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
    );
};

/**
 * Verifica y decodifica un JWT access token
 * @param {string} token - Token a verificar
 * @returns {Promise<object|null>} Payload decodificado o null si inválido
 */
export const verifyAccessToken = async (token) => {
    try {
        const { default: jwt } = await import('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded;
    } catch (error) {
        return null;
    }
};

/**
 * Verifica y decodifica un JWT refresh token
 * @param {string} token - Refresh token a verificar
 * @returns {Promise<object|null>} Payload decodificado o null si inválido
 */
export const verifyRefreshToken = async (token) => {
    try {
        const { default: jwt } = await import('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.type !== 'refresh') return null;
        return decoded;
    } catch (error) {
        return null;
    }
};

/**
 * Guarda un refresh token en la BD para permitir revocación
 * @param {number} userId - ID del usuario
 * @param {string} token - Refresh token a guardar
 * @param {Date} expiresAt - Fecha de expiración del token
 * @returns {Promise<boolean>} true si se guardó exitosamente
 */
export const saveRefreshTokenToDB = async (supabase, userId, token, expiresAt) => {
    try {
        const { error } = await supabase
            .from('refresh_tokens')
            .insert([
                {
                    usr_id: userId,
                    token,
                    expires_at: expiresAt.toISOString(),
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) {
            console.error('Error guardando refresh token en BD:', error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error en saveRefreshTokenToDB:', error);
        return false;
    }
};

/**
 * Verifica que un refresh token exista en la BD (no ha sido revocado)
 * @param {object} supabase - Cliente de Supabase
 * @param {string} token - Refresh token a verificar
 * @returns {Promise<object|null>} Registro del token o null si no existe
 */
export const verifyRefreshTokenInDB = async (supabase, token) => {
    try {
        const { data, error } = await supabase
            .from('refresh_tokens')
            .select('*')
            .eq('token', token)
            .single();

        if (error || !data) {
            return null;
        }

        // Verificar que no haya expirado
        if (new Date(data.expires_at) < new Date()) {
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error en verifyRefreshTokenInDB:', error);
        return null;
    }
};

/**
 * Elimina un refresh token de la BD (al hacer logout)
 * @param {object} supabase - Cliente de Supabase
 * @param {string} token - Refresh token a eliminar
 * @returns {Promise<boolean>} true si se eliminó exitosamente
 */
export const deleteRefreshTokenFromDB = async (supabase, token) => {
    try {
        const { error } = await supabase
            .from('refresh_tokens')
            .delete()
            .eq('token', token);

        if (error) {
            console.error('Error eliminando refresh token de BD:', error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error en deleteRefreshTokenFromDB:', error);
        return false;
    }
};
