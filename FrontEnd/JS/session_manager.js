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
        const serverUser = window.__ADI_SERVER_USER__;

        if (!raw) {
            return (serverUser && typeof serverUser === 'object') ? serverUser : null;
        }

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;

        if (serverUser && typeof serverUser === 'object') {
            return { ...serverUser, ...parsed };
        }

        return parsed;
    } catch {
        const serverUser = window.__ADI_SERVER_USER__;
        return (serverUser && typeof serverUser === 'object') ? serverUser : null;
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
    window.location.replace(`/session-invalid?reason=${encodeURIComponent(reasonKey)}`);
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

// Wrapper global para bloquear un botón mientras se ejecuta una operación async.
// Uso: await withButtonLock(buttonElement, async () => { ... }, { loadingText: 'CARGANDO...' })
async function withButtonLock(button, asyncFn, opts = {}) {
    if (typeof window.withButtonLock === 'function' && window.withButtonLock !== withButtonLock) {
        return window.withButtonLock(button, asyncFn, opts);
    }

    if (!button) {
        return await asyncFn();
    }

    if (button.dataset && button.dataset.__locked === 'true') return;

    const originalDisabled = button.disabled;
    const originalText = button.textContent;
    try {
        if (button.dataset) button.dataset.__locked = 'true';
        button.disabled = true;
        if (opts.loadingText) {
            try { button.textContent = opts.loadingText; } catch (e) {}
        }
        return await asyncFn();
    } finally {
        try { button.disabled = originalDisabled; } catch (e) {}
        try { if (originalText !== undefined) button.textContent = originalText; } catch (e) {}
        if (button.dataset) delete button.dataset.__locked;
    }
}

// Exponer globalmente para que otros módulos lo utilicen directamente
window.withButtonLock = withButtonLock;

// Simple lock per key to prevent concurrent executions of the same task.
const __adiLocks = new Map();
async function withLock(key, asyncFn, opts = {}) {
    if (!key) return await asyncFn();
    // If there's an ongoing promise, wait for it to finish before running.
    const existing = __adiLocks.get(key);
    if (existing) {
        try {
            await existing;
        } catch {
            // ignore prior error
        }
    }

    const p = (async () => {
        try {
            return await asyncFn();
        } finally {
            // noop
        }
    })();

    __adiLocks.set(key, p);
    try {
        const r = await p;
        return r;
    } finally {
        // remove lock after completion
        if (__adiLocks.get(key) === p) __adiLocks.delete(key);
    }
}

window.withLock = withLock;

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
            await endSession('invalid-session', true);
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
    window.location.replace('/unauthorized');
    return false;
}

// Aplica comportamiento compartido de sidebar en vistas autenticadas.
function initializeSharedSidebarBehavior() {
    const currentPath = window.location.pathname;

    // Estas vistas ya incluyen la version completa de la logica en su propio script.
    if (currentPath === '/main' || currentPath === '/profile' || currentPath === '/notifications' || currentPath.startsWith('/support')) {
        return;
    }

    const body = document.body;
    const sidebar = document.getElementById('adi-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const toggle = document.getElementById('sidebar-toggle');

    if (!body || !sidebar || !toggle) {
        return;
    }

    let isDesktop = window.innerWidth > 768;
    const sidebarState = localStorage.getItem('sidebarExpanded');
    const initialExpanded = sidebarState === null ? true : sidebarState === 'true';

    const setSidebarExpanded = (expanded) => {
        body.classList.toggle('sidebar-expanded', expanded);
        body.classList.toggle('sidebar-collapsed', !expanded);
        toggle.setAttribute('aria-expanded', String(expanded));

        if (isDesktop) {
            localStorage.setItem('sidebarExpanded', String(expanded));
        }
    };

    const setSidebarOpen = (open) => {
        body.classList.toggle('sidebar-open', open);
        body.classList.toggle('sidebar-backdrop-active', open);
    };

    if (isDesktop) {
        setSidebarExpanded(initialExpanded);
        setSidebarOpen(false);
    } else {
        body.classList.add('sidebar-expanded');
        body.classList.remove('sidebar-collapsed');
        setSidebarOpen(false);
    }

    // Captura el click antes que handlers legacy para evitar doble toggle.
    toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();

        if (isDesktop) {
            const currentExpanded = body.classList.contains('sidebar-expanded');
            setSidebarExpanded(!currentExpanded);
        } else {
            setSidebarOpen(!body.classList.contains('sidebar-open'));
        }
    }, true);

    if (backdrop) {
        backdrop.addEventListener('click', () => {
            if (!isDesktop) {
                setSidebarOpen(false);
            }
        });
    }

    sidebar.addEventListener('click', (e) => {
        if (!isDesktop && e.target.closest('a.sidebar-link, a.sidebar-sublink')) {
            setSidebarOpen(false);
        }
    });

    const accountingMenu = document.getElementById('accounting-menu');
    const accountingSubmenu = document.getElementById('accounting-submenu');
    if (accountingMenu && accountingSubmenu) {
        accountingMenu.addEventListener('click', (e) => {
            e.preventDefault();
            accountingMenu.classList.toggle('open');
            accountingSubmenu.classList.toggle('open');
        });
    }

    const supportMenu = document.getElementById('support-menu');
    const supportSubmenu = document.getElementById('support-submenu');
    if (supportMenu && supportSubmenu) {
        supportMenu.addEventListener('click', (e) => {
            e.preventDefault();
            supportMenu.classList.toggle('open');
            supportSubmenu.classList.toggle('open');
        });
    }

    if (currentPath.includes('/accounting')) {
        accountingMenu?.classList.add('open');
        accountingSubmenu?.classList.add('open');
    }

    document.querySelectorAll('.sidebar-link:not(.has-submenu)').forEach((link) => {
        const href = link.getAttribute('href');
        if (!href) return;
        if (href === currentPath
            || (href === '/incident-board' && currentPath.includes('/incident'))
            || (href === '/departments' && currentPath.includes('/departments'))
            || (href === '/reports' && currentPath.includes('/reports'))
            || (href === '/support' && currentPath.startsWith('/support'))) {
            link.classList.add('active');
        }
    });

    document.querySelectorAll('.sidebar-sublink').forEach((link) => {
        const href = link.getAttribute('href');
        if (!href) return;
        if (href === currentPath || (href === '/accounting' && currentPath.startsWith('/accounting'))) {
            link.classList.add('active');
        }
    });

    if (supportMenu && supportSubmenu && currentPath.startsWith('/support')) {
        supportMenu.classList.add('open');
        supportSubmenu.classList.add('open');
    }

    document.querySelectorAll('.sidebar-link-copy strong').forEach((label) => {
        if ((label.textContent || '').trim().length > 18) {
            label.classList.add('is-long-label');
        }
    });

    window.addEventListener('resize', () => {
        const nowDesktop = window.innerWidth > 768;
        if (nowDesktop === isDesktop) return;

        isDesktop = nowDesktop;

        if (isDesktop) {
            const savedState = localStorage.getItem('sidebarExpanded');
            const shouldExpand = savedState === null ? true : savedState === 'true';
            setSidebarExpanded(shouldExpand);
            setSidebarOpen(false);
        } else {
            body.classList.remove('sidebar-collapsed');
            body.classList.add('sidebar-expanded');
            setSidebarOpen(false);
        }
    });
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
        const currentPath = String(window.location.pathname || '').trim();
        const publicPaths = ['/login', '/forgot-password', '/session-invalid', '/unauthorized', '/'];
        const isPublicPath = publicPaths.some(p => p === '/' ? currentPath === '/' : currentPath === p || currentPath.startsWith(p + '/'));

        const user = safeParseUserSession();
        if (!user) {
            if (isPublicPath) return; // No redirigir desde páginas públicas (ej. /login)
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
        initializeSharedSidebarBehavior();

        // Fetch unread notifications count and update global indicator
        (async () => {
            try {
                const resp = await fetch(`/api/notifications?usr_id=${encodeURIComponent(user.id)}&order=desc`);
                if (!resp.ok) return;
                const data = await resp.json();
                if (!data || !data.success) return;
                const unread = (data.notifications || []).filter(n => !n.read).length;
                // Expose updater for other pages
                window.updateGlobalUnreadIndicator = (count) => {
                    const body = document.body;
                    if (!body) return;
                    if (Number(count) > 0) {
                        body.classList.add('has-unread-notifications');
                    } else {
                        body.classList.remove('has-unread-notifications');
                    }
                };

                // Initial set
                window.updateGlobalUnreadIndicator(unread);

                // Inject simple style to tint ONLY the notifications icon when unread exist
                if (!document.getElementById('adi-unread-style')) {
                    const style = document.createElement('style');
                    style.id = 'adi-unread-style';
                    style.textContent = `
                        /* Target anchors that link to the notifications page or have aria-label */
                        body.has-unread-notifications a[aria-label="Notificaciones"] .material-symbols-outlined,
                        body.has-unread-notifications a[href="/notifications"] .material-symbols-outlined {
                            color: #d9534f !important;
                        }
                    `;
                    document.head.appendChild(style);
                }
            } catch (e) {
                // no-op
            }
        })();

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
