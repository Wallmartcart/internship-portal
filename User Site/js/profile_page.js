  window.onload = function() {
    const params = new URLSearchParams(window.location.search);
    const name = params.get('name') || 'Guest';
    const email = params.get('email') || '';

    // Debugging: show values in console
    console.log('Loaded name:', name);
    console.log('Loaded email:', email);

    document.body.innerHTML = document.body.innerHTML.replace(/{name}/g, name);
    document.body.innerHTML = document.body.innerHTML.replace(/{email}/g, email);

    const nameInput = document.querySelector('input[name="name"]');
    if (nameInput) nameInput.value = name;

    const emailInput = document.querySelector('input[name="email"]');
    if (emailInput) emailInput.value = email;

    const currentEmailInput = document.querySelector('input[name="currentEmail"]');
    if (currentEmailInput) currentEmailInput.value = email;
  }
