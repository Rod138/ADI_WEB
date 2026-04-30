/**
 * TESINA: Utilidades compartidas para gestionar sesion y permisos en frontend.
 * Responsabilidad: interpretar usuario en sessionStorage y resolver rol activo.
 * Uso: centraliza reglas para evitar duplicacion en vistas.
 */

const ADI_ROLES = Object.freeze({
    RESIDENTE: 1,
    TESORERO: 2,
    ADMINISTRADOR: 3,
    TESORERO_ADMIN: 4
});

const SESSION_TIMEOUT_MS = 3 * 24 * 60 * 60 * 1000;
let sessionTimeoutHandle = null;

// Lee la sesion desde storage y evita fallos por JSON malformado.
function safeParseUserSession() {
    try {
        const raw = sessionStorage.getItem('user');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
    } catch {
        return null;
    }
}

// Convierte rol numerico en etiqueta legible para badges y mensajes.
function getRoleLabel(roleId) {
    const role = Number(roleId);
    switch (role) {
        case ADI_ROLES.RESIDENTE: return 'Residente';
        case ADI_ROLES.TESORERO: return 'Tesorero';
        case ADI_ROLES.ADMINISTRADOR: return 'Administrador';
        case ADI_ROLES.TESORERO_ADMIN: return 'Tesorero y Admin';
        default: return 'Usuario';
    }
}

// Verifica autorizacion por jerarquia minima de rol.
function hasMinRole(user, minRole) {
    if (!user) return false;
    return Number(user.rol_id || 0) >= Number(minRole || 0);
}

// Abstrae notificaciones al usuario con fallback a alert nativo.
function showUserMessage(title, message, icon = 'warning') {
    if (typeof Swal !== 'undefined' && Swal && typeof Swal.fire === 'function') {
        return Swal.fire({
            icon,
            title,
            text: message,
            timer: 2200,
            timerProgressBar: true,
            showConfirmButton: false
        });
    }
    window.alert(message);
    return Promise.resolve();
}

function getSessionDeadline(user) {
    const rawValue = Number(user?.sessionExpiresAt || 0);
    if (!Number.isFinite(rawValue) || rawValue <= 0) return 0;
    return rawValue;
}

function isSessionExpired(user) {
    const deadline = getSessionDeadline(user);
    if (!deadline) return true;
    return Date.now() >= deadline;
}

function storeLoginNotice(reasonKey) {
    if (!reasonKey) return;
    try {
        localStorage.setItem('adi_login_notice', reasonKey);
    } catch {
        // No bloquear flujo por almacenamiento.
    }
}

async function endSession(reasonKey = 'session-ended', shouldCallLogoutApi = true) {
    if (window.__adiEndingSession) return;
    window.__adiEndingSession = true;

    const currentUser = safeParseUserSession();
    const refreshToken = currentUser?.refreshToken || '';

    if (shouldCallLogoutApi && refreshToken) {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
        } catch {
            // Continuar cierre local aunque el servidor no responda.
        }
    }

    sessionStorage.removeItem('user');
    storeLoginNotice(reasonKey);
    window.location.replace(`/login?reason=${encodeURIComponent(reasonKey)}`);
}

function scheduleSessionTimeout(user) {
    if (sessionTimeoutHandle) {
        clearTimeout(sessionTimeoutHandle);
        sessionTimeoutHandle = null;
    }

    const deadline = getSessionDeadline(user);
    if (!deadline) return;

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
        endSession('session-ended', true);
        return;
    }

    sessionTimeoutHandle = setTimeout(() => {
        endSession('session-ended', true);
    }, remainingMs);
}

// Desactiva las animaciones de SweetAlert2 para mantener la interfaz estática.
function disableSwalAnimations() {
    if (typeof Swal === 'undefined' || !Swal || typeof Swal.fire !== 'function') return;
    if (window.__adiSwalAnimationsDisabled) return;

    const nativeFire = Swal.fire.bind(Swal);
    Swal.fire = (...args) => {
        if (!args.length) {
            return nativeFire({
                showClass: { popup: '' },
                hideClass: { popup: '' }
            });
        }

        const firstArg = args[0];
        if (firstArg && typeof firstArg === 'object' && !Array.isArray(firstArg)) {
            return nativeFire({
                showClass: { popup: '' },
                hideClass: { popup: '' },
                ...firstArg
            });
        }

        return nativeFire(...args);
    };

    window.__adiSwalAnimationsDisabled = true;
}

// Intercepta fetch para adjuntar encabezado de sesion en llamadas API internas.
function patchApiFetchHeaders() {
    if (window.__adiFetchPatched) return;
    if (typeof window.fetch !== 'function') return;

    const nativeFetch = window.fetch.bind(window);

    window.fetch = async (input, init = {}) => {
        const requestUrl = typeof input === 'string' ? input : (input?.url || '');
        const shouldAttachSession = requestUrl.startsWith('/api/')
            && !requestUrl.startsWith('/api/login')
            && !requestUrl.startsWith('/api/forgot-password')
            && !requestUrl.startsWith('/api/refresh-token')
            && !requestUrl.startsWith('/api/logout');

        if (!shouldAttachSession) {
            return nativeFetch(input, init);
        }

        const currentUser = safeParseUserSession();
        if (!currentUser || isSessionExpired(currentUser)) {
            await endSession('session-ended', true);
            throw new Error('Session expired');
        }

        const mergedHeaders = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));

        // Usar JWT en Authorization header
        if (currentUser?.accessToken) {
            mergedHeaders.set('Authorization', `Bearer ${currentUser.accessToken}`);
        }

        const response = await nativeFetch(input, {
            ...init,
            headers: mergedHeaders
        });

        if (response.status === 401) {
            await endSession('session-ended', true);
        }

        return response;
    };

    window.__adiFetchPatched = true;
}

// Oculta nodos restringidos cuando el rol del usuario no cumple requisitos.
function applyRoleVisibility(user) {
    const roleLockedNodes = document.querySelectorAll('[data-min-role]');
    roleLockedNodes.forEach((node) => {
        const minRole = Number(node.getAttribute('data-min-role') || 0);
        if (!minRole) return;

        if (!hasMinRole(user, minRole)) {
            node.style.display = 'none';
        }
    });
}

// Impide navegar a paginas con restriccion superior al rol actual.
async function enforcePageRole(user) {
    const pageMinRole = Number(document.body?.getAttribute('data-min-role') || 0);
    if (!pageMinRole) return true;

    if (hasMinRole(user, pageMinRole)) {
        return true;
    }

    await showUserMessage('Acceso restringido', `Tu rol (${getRoleLabel(user?.rol_id)}) no tiene permiso para entrar a esta seccion.`);
    window.location.replace('/main');
    return false;
}

    window.ADIAuth = {
        roles: ADI_ROLES,
        getCurrentUser: safeParseUserSession,
        getRoleLabel,
        hasMinRole
    };

    patchApiFetchHeaders();
    disableSwalAnimations();

    window.addEventListener('pageshow', async function () {
        const user = safeParseUserSession();
        if (!user) {
            window.location.replace('/login');
            return;
        }

        if (isSessionExpired(user)) {
            await endSession('session-ended', true);
            return;
        }

        scheduleSessionTimeout(user);

        const allowed = await enforcePageRole(user);
        if (!allowed) return;

        applyRoleVisibility(user);

        const span = document.getElementById('user-name');
        if (span) span.textContent = user.name;

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async function (e) {
                e.preventDefault();
                try {
                    const currentUser = safeParseUserSession();
                    await fetch('/api/logout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ refreshToken: currentUser?.refreshToken || '' })
                    });
                } catch {
                    // Continuar cierre local aunque falle el servidor.
                }

                sessionStorage.removeItem('user');
                await showUserMessage('Sesion cerrada', 'Hasta pronto.', 'success');
                window.location.replace('/');
            });
        }
    });
