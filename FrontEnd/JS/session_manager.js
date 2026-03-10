window.addEventListener('pageshow', function () {
    const user = JSON.parse(sessionStorage.getItem('user'));
    if (!user) {
        window.location.replace('/login');
        return;
    }
    const span = document.getElementById('user-name');
    if (span) span.textContent = user.name;

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            sessionStorage.removeItem('user');
            await Swal.fire({
                titleText: 'Sesión cerrada',
                icon: 'error',
                timer: 2000,
                timerProgressBar: true,
                draggable: true,
                theme: 'auto'
            });
            window.location.replace('/');
        });
    }
});

/*
window.addEventListener('pagehide', function () {
    sessionStorage.removeItem('user');
});
*/
