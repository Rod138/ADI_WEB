document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const sidebar = document.getElementById('adi-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const toggle = document.getElementById('sidebar-toggle');
    const accountingMenu = document.getElementById('accounting-menu');
    const accountingSubmenu = document.getElementById('accounting-submenu');
    const supportMenu = document.getElementById('support-menu');
    const supportSubmenu = document.getElementById('support-submenu');

    const form = document.getElementById('create-ticket-form');
    const areaSelect = document.getElementById('area_id');
    const errorTypeSelect = document.getElementById('error_type_id');
    const descriptionInput = document.getElementById('description');
    const evidenceInput = document.getElementById('evidence_url');
    const evidenceUploadBtn = document.getElementById('evidence_upload');
    const evidenceFilename = document.getElementById('evidence_filename');
    const descCounter = document.getElementById('desc-counter');
    const ticketsList = document.getElementById('tickets-list');
    const refreshFormBtn = document.getElementById('refresh-form-btn');
    const refreshListBtn = document.getElementById('refresh-list-btn');
    const submitBtn = document.getElementById('submit-ticket-btn');
    const statTotal = document.querySelector('[data-stat="total"]');
    const statPending = document.querySelector('[data-stat="pending"]');
    const statClosed = document.querySelector('[data-stat="closed"]');

    const currentUser = window.ADIAuth?.getCurrentUser?.() || null;
    const isDesktop = window.innerWidth > 768;

    // Evidence file upload (incidencias-style)
    const evidenceFileInput = document.getElementById('evidence_file');
    const CLOUDINARY_CLOUD_NAME = document.body.dataset.cloudinaryCloudName || '';
    const CLOUDINARY_UPLOAD_PRESET = document.body.dataset.cloudinaryUploadPreset || '';
    const CLOUDINARY_IMAGE_UPLOAD_URL = CLOUDINARY_CLOUD_NAME ? `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload` : '';

    evidenceUploadBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        evidenceFileInput?.click();
    });

    evidenceFileInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            await showMessage('Archivo muy grande', 'La imagen no debe superar 5MB.', 'error');
            e.target.value = '';
            return;
        }

        if (!CLOUDINARY_IMAGE_UPLOAD_URL || !CLOUDINARY_UPLOAD_PRESET) {
            await showMessage('Error', 'No está configurado el servicio de imágenes.', 'error');
            e.target.value = '';
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

            const uploadRes = await fetch(CLOUDINARY_IMAGE_UPLOAD_URL, {
                method: 'POST',
                body: formData
            });

            const uploadData = await uploadRes.json();

            if (uploadData.secure_url) {
                evidenceInput.value = uploadData.secure_url;
                const filename = uploadData.original_filename || uploadData.public_id || 'Archivo cargado';
                evidenceFilename.textContent = filename;
                await showMessage('Cargado', 'Imagen subida correctamente.', 'success');
            } else {
                throw new Error('No se recibió URL de la imagen');
            }
        } catch (err) {
            await showMessage('Error', 'Fallo al subir la imagen.', 'error');
        } finally {
            e.target.value = '';
        }
    });

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const formatDateTime = (iso) => {
        if (!iso) return 'Sin fecha';
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return 'Sin fecha';
        return date.toLocaleString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const statusClass = (name) => String(name || '')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '') || 'unknown';

    const showMessage = (title, text, icon = 'info') => {
        if (typeof Swal !== 'undefined' && Swal.fire) {
            return Swal.fire({ icon, title, text, confirmButtonColor: '#5f733d' });
        }
        window.alert(text);
        return Promise.resolve();
    };

    const setRoleLabel = () => {
        const roleEl = document.getElementById('user-role');
        if (!roleEl || !window.ADIAuth?.getRoleLabel) return;
        roleEl.textContent = window.ADIAuth.getRoleLabel(currentUser?.rol_id);
    };

    const setSidebarExpanded = (expanded) => {
        body.classList.toggle('sidebar-expanded', expanded);
        body.classList.toggle('sidebar-collapsed', !expanded);
        toggle?.setAttribute('aria-expanded', String(expanded));
        if (isDesktop) {
            localStorage.setItem('sidebarExpanded', String(expanded));
        }
    };

    const setSidebarOpen = (open) => {
        body.classList.toggle('sidebar-open', open);
        body.classList.toggle('sidebar-backdrop-active', open);
    };

    const initSidebar = () => {
        const sidebarState = localStorage.getItem('sidebarExpanded');
        const isExpanded = sidebarState === null ? true : sidebarState === 'true';

        if (isDesktop) {
            setSidebarExpanded(isExpanded);
            setSidebarOpen(false);
        } else {
            body.classList.add('sidebar-expanded');
            body.classList.remove('sidebar-collapsed');
            setSidebarOpen(false);
        }

        toggle?.addEventListener('click', () => {
            if (isDesktop) {
                setSidebarExpanded(!body.classList.contains('sidebar-expanded'));
            } else {
                setSidebarOpen(!body.classList.contains('sidebar-open'));
            }
        });

        backdrop?.addEventListener('click', () => {
            if (!isDesktop) {
                setSidebarOpen(false);
            }
        });

        sidebar?.addEventListener('click', (event) => {
            if (!isDesktop && event.target.closest('a.sidebar-link, a.sidebar-sublink')) {
                setSidebarOpen(false);
            }
        });

        if (accountingMenu && accountingSubmenu) {
            accountingMenu.addEventListener('click', (event) => {
                event.preventDefault();
                accountingMenu.classList.toggle('open');
                accountingSubmenu.classList.toggle('open');
            });
        }

        if (supportMenu && supportSubmenu) {
            supportMenu.classList.add('open');
            supportSubmenu.classList.add('open');
            supportMenu.addEventListener('click', (event) => {
                event.preventDefault();
                supportMenu.classList.toggle('open');
                supportSubmenu.classList.toggle('open');
            });
        }

        const currentPath = window.location.pathname;
        document.querySelectorAll('.sidebar-link').forEach((link) => {
            const href = link.getAttribute('href');
            if (href === '/main' && currentPath === '/main') link.classList.add('active');
            if (href === '/support' && currentPath.startsWith('/support')) link.classList.add('active');
            if (href === '/reports' && currentPath.startsWith('/reports')) link.classList.add('active');
            if (href === '/incident-board' && currentPath.includes('/incident')) link.classList.add('active');
            if (href === '/accounting' && currentPath.startsWith('/accounting')) link.classList.add('active');
            if (href === '/departments' && currentPath === '/departments') link.classList.add('active');
        });

        document.querySelectorAll('.sidebar-sublink').forEach((link) => {
            const href = link.getAttribute('href');
            if (href === '/support/tickets' && currentPath === '/support/tickets') link.classList.add('active');
            if (href === '/support/faqs' && currentPath === '/support/faqs') link.classList.add('active');
            if (href === '/support' && currentPath === '/support') link.classList.add('active');
            if (href === '/accounting' && currentPath.startsWith('/accounting')) link.classList.add('active');
        });
    };

    const apiJson = async (url, options = {}) => {
        const response = await fetch(url, {
            cache: 'no-store',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
            ...options
        });

        const text = await response.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = { success: false, message: text };
        }

        if (!response.ok) {
            const error = new Error(data?.message || 'Error en la petición');
            error.response = response;
            error.data = data;
            throw error;
        }

        return data;
    };

    const normalizeItems = (payload) => {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.data)) return payload.data;
        if (Array.isArray(payload?.tickets)) return payload.tickets;
        return [];
    };

    const updateCounters = (items) => {
        const total = items.length;
        const pending = items.filter((item) => {
            const name = String(item?.status?.name || item?.status?.status || '').toLowerCase();
            return !name || name.includes('pend') || name.includes('abiert') || name.includes('proceso');
        }).length;
        const closed = items.filter((item) => {
            const name = String(item?.status?.name || item?.status?.status || '').toLowerCase();
            return name.includes('cerr') || name.includes('resuel') || name.includes('complet');
        }).length;

        if (statTotal) statTotal.textContent = String(total);
        if (statPending) statPending.textContent = String(pending);
        if (statClosed) statClosed.textContent = String(closed);
    };

    const renderTickets = (items) => {
        updateCounters(items);

        if (!items.length) {
            ticketsList.innerHTML = `
                <div class="tickets-empty">
                    <span class="material-symbols-outlined">confirmation_number</span>
                    <h3>No tienes tickets todavía</h3>
                    <p>Cuando envíes una solicitud, aparecerá aquí con su estado y prioridad.</p>
                </div>
            `;
            return;
        }

        ticketsList.innerHTML = items.map((ticket) => {
            const area = ticket?.areas?.name || 'Sin área';
            const errorType = ticket?.error_types?.name || 'Sin tipo';
            const statusName = ticket?.status?.name || 'Sin estado';
            const priorityName = ticket?.priority?.name || 'Sin prioridad';
            const resolutionNote = ticket?.resolution_note || '';
            const descriptionFull = String(ticket?.description || 'Sin descripción');
            const descriptionShort = descriptionFull.length > 80
                ? `${descriptionFull.slice(0, 80)}...`
                : descriptionFull;
            const evidenceUrl = ticket?.evidence_url || '';
            const reopened = Number(ticket?.reopened_count || 0);

            return `
                <article class="ticket-card">
                    <div class="ticket-card__header">
                        <div>
                            <span class="ticket-id">Ticket #${escapeHtml(ticket?.id)}</span>
                            <h3>${escapeHtml(area)} · ${escapeHtml(errorType)}</h3>
                        </div>
                        <span class="ticket-status status-${statusClass(statusName)}">${escapeHtml(statusName)}</span>
                    </div>

                    <div class="ticket-card__meta">
                        <span><strong>Fecha:</strong> ${escapeHtml(formatDateTime(ticket?.created_at))}</span>
                        <span><strong>Prioridad:</strong> ${escapeHtml(priorityName)}</span>
                        ${reopened > 0 ? `<span><strong>Reabierto:</strong> ${reopened} vez${reopened === 1 ? '' : 'es'}</span>` : ''}
                    </div>

                    <button type="button" class="ticket-description ticket-description-btn" data-description="${escapeHtml(descriptionFull)}">${escapeHtml(descriptionShort)}</button>

                    <div class="ticket-card__footer">
                        ${evidenceUrl ? `<button type="button" class="evidence-btn" data-image="${escapeHtml(evidenceUrl)}">Ver evidencia</button>` : '<span class="ticket-muted">Sin evidencia adjunta</span>'}
                    </div>

                    ${resolutionNote ? `
                        <div class="ticket-resolution">
                            <span>Resolución</span>
                            <p>${escapeHtml(resolutionNote)}</p>
                        </div>
                    ` : ''}
                </article>
            `;
        }).join('');

        // After inserting HTML, attach handlers
        attachEvidenceHandlers();
    };

    // Attach click handlers to evidence buttons after rendering
    const attachEvidenceHandlers = () => {
        document.querySelectorAll('.evidence-btn').forEach((btn) => {
            if (btn._hasHandler) return;
            btn._hasHandler = true;
            btn.addEventListener('click', async () => {
                const imageUrl = btn.dataset.image;
                if (!imageUrl) return;

                await Swal.fire({
                    title: 'Evidencia',
                    imageUrl: imageUrl,
                    imageAlt: 'Evidencia adjunta',
                    confirmButtonText: 'Cerrar'
                });
            });
        });

        document.querySelectorAll('.ticket-description-btn').forEach((btn) => {
            if (btn._hasHandler) return;
            btn._hasHandler = true;
            btn.addEventListener('click', () => {
                const description = btn.dataset.description || 'Sin descripción';
                Swal.fire({
                    title: 'Descripción completa',
                    html: `<div style="text-align:left; white-space:pre-wrap; word-break:break-word; line-height:1.5;">${escapeHtml(description)}</div>`,
                    confirmButtonText: 'Cerrar',
                    confirmButtonColor: '#6A8042'
                });
            });
        });
    };

    const loadAreas = async () => {
        areaSelect.disabled = true;
        areaSelect.innerHTML = '<option value="">Cargando áreas...</option>';

        try {
            const payload = await apiJson('/api/support/areas');
            const items = normalizeItems(payload).sort((a, b) => Number(a.id) - Number(b.id));

            areaSelect.innerHTML = '<option value="">Selecciona un área</option>';
            items.forEach((area) => {
                const option = document.createElement('option');
                option.value = area.id;
                option.textContent = area.name || area.description || `Área ${area.id}`;
                areaSelect.appendChild(option);
            });

            areaSelect.disabled = false;
        } catch (error) {
            if (error.response?.status === 404) {
                areaSelect.innerHTML = '<option value="">No hay áreas disponibles</option>';
                return;
            }

            areaSelect.innerHTML = '<option value="">No se pudieron cargar las áreas</option>';
            await showMessage('No se cargaron las áreas', error.data?.message || 'Intenta recargar la página.', 'error');
        }
    };

    const loadErrorTypes = async (areaId) => {
        if (!areaId) {
            errorTypeSelect.disabled = true;
            errorTypeSelect.innerHTML = '<option value="">Selecciona un área primero</option>';
            return;
        }

        errorTypeSelect.disabled = true;
        errorTypeSelect.innerHTML = '<option value="">Cargando tipos...</option>';

        try {
            const payload = await apiJson(`/api/support/error-types/${encodeURIComponent(areaId)}`);
            const items = normalizeItems(payload).sort((a, b) => Number(a.id) - Number(b.id));

            errorTypeSelect.innerHTML = '<option value="">Selecciona un tipo</option>';
            items.forEach((type) => {
                const option = document.createElement('option');
                option.value = type.id;
                option.textContent = type.name || `Tipo ${type.id}`;
                errorTypeSelect.appendChild(option);
            });

            errorTypeSelect.disabled = false;
        } catch (error) {
            if (error.response?.status === 404) {
                errorTypeSelect.innerHTML = '<option value="">No hay tipos para esta área</option>';
                errorTypeSelect.disabled = true;
                return;
            }

            errorTypeSelect.innerHTML = '<option value="">No se pudieron cargar los tipos</option>';
            await showMessage('No se cargaron los tipos de error', error.data?.message || 'Selecciona otra área o recarga.', 'error');
        }
    };

    const loadTickets = async () => {
        return await withLock('support-loadTickets', async () => {
            ticketsList.innerHTML = '<div class="tickets-state">Cargando tickets...</div>';

            try {
                const payload = await apiJson('/api/support/tickets');
                const items = normalizeItems(payload);
                renderTickets(items);
            } catch (error) {
                if (error.response?.status === 404) {
                    renderTickets([]);
                    return;
                }

                ticketsList.innerHTML = '<div class="tickets-state tickets-state--error">No se pudieron cargar tus tickets.</div>';
                await showMessage('No se pudieron cargar tus tickets', error.data?.message || 'Intenta recargar la página.', 'error');
            }
        });
    };

    const submitTicket = async (event) => {
        event.preventDefault();

        const payload = {
            area_id: Number(areaSelect.value),
            error_type_id: Number(errorTypeSelect.value),
            description: descriptionInput.value.trim(),
            evidence_url: evidenceInput.value.trim() || null,
        };

        if (!payload.area_id || !payload.error_type_id || !payload.description) {
            await showMessage('Faltan datos', 'Completa el área, el tipo de error y la descripción.', 'warning');
            return;
        }

        await withButtonLock(submitBtn, async () => {
            try {
                await apiJson('/api/support/tickets', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                form.reset();
                errorTypeSelect.innerHTML = '<option value="">Selecciona un área primero</option>';
                errorTypeSelect.disabled = true;
                descCounter.textContent = '0/250';
                evidenceFilename.textContent = 'Sin archivo seleccionado';

                await showMessage('Ticket creado', 'Tu ticket fue enviado correctamente.', 'success');
                await loadTickets();
            } catch (error) {
                await showMessage('No se pudo crear el ticket', error.data?.message || 'Revisa los datos e inténtalo de nuevo.', 'error');
            }
        }, { loadingText: 'ENVIANDO...' });
    };

    descriptionInput?.addEventListener('input', () => {
        descCounter.textContent = `${descriptionInput.value.length}/250`;
    });

    areaSelect?.addEventListener('change', () => {
        loadErrorTypes(areaSelect.value);
    });


    refreshFormBtn?.addEventListener('click', loadAreas);
    refreshListBtn?.addEventListener('click', loadTickets);
    form?.addEventListener('submit', submitTicket);

    setRoleLabel();
    initSidebar();

    loadAreas();
    loadTickets();
});
