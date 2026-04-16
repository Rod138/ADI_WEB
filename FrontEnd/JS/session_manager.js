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

// Intercepta fetch para adjuntar encabezado de sesion en llamadas API internas.
function patchApiFetchHeaders() {
    if (window.__adiFetchPatched) return;
    if (typeof window.fetch !== 'function') return;

    const nativeFetch = window.fetch.bind(window);

    window.fetch = (input, init = {}) => {
        const requestUrl = typeof input === 'string' ? input : (input?.url || '');
        const shouldAttachSession = requestUrl.startsWith('/api/')
            && !requestUrl.startsWith('/api/login')
            && !requestUrl.startsWith('/api/forgot-password');

        if (!shouldAttachSession) {
            return nativeFetch(input, init);
        }

        const currentUser = safeParseUserSession();
        const mergedHeaders = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));

        if (currentUser?.id) {
            mergedHeaders.set('x-session-user-id', String(currentUser.id));
        }

        return nativeFetch(input, {
            ...init,
            headers: mergedHeaders
        });
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

window.addEventListener('pageshow', async function () {
    const user = safeParseUserSession();
    if (!user) {
        window.location.replace('/login');
        return;
    }

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
                // Limpiar cookie del lado del servidor
                await fetch('/api/logout', { method: 'POST' });
            } catch (err) {
                console.error('Error al limpiar sesión en servidor:', err);
            }
            // Limpiar sessionStorage del lado del cliente
            sessionStorage.removeItem('user');
            await showUserMessage('Sesion cerrada', 'Hasta pronto.', 'success');
            window.location.replace('/');
        });
    }
});
