async function main() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');

  if (error) {
    const box = document.createElement('div');
    box.className = 'message-box error';
    box.textContent = `Error de autenticación: ${error}`;
    document.querySelector('.hero-card')?.prepend(box);
  }

  const response = await fetch('/api/me');
  const data = await response.json();

  if (data.authenticated) {
    window.location.href = data.user.isAdmin ? '/admin.html' : '/vote.html';
  }
}

main();
