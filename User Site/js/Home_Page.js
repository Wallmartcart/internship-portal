// Fills in the student's name on the dashboard from the logged-in session
window.addEventListener('load', async () => {
    try {
        const res = await fetch('/api/session', { credentials: 'include' });
        const data = await res.json();
        if (!data.loggedIn || data.user.role !== 'student') {
            window.location.href = '/user/login';
            return;
        }
        const header = document.querySelector('h1');
        if (header) header.textContent = `Welcome, ${data.user.full_name}!`;
    } catch (err) {
        console.error('Could not load session:', err);
    }
});
