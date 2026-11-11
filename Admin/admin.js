// admin.js
document.addEventListener("DOMContentLoaded", () => {
  const forms = document.querySelectorAll("form");

  forms.forEach((form) => {
    form.addEventListener("submit", (e) => {
      let isValid = true;

      // Email validation
      const emailField = form.querySelector("input[type='email']");
      if (emailField && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailField.value)) {
        alert("Please enter a valid email address.");
        isValid = false;
      }


      // Password check (if exists)
      const passwordField = form.querySelector("input[type='password']");
      if (passwordField && passwordField.value.length < 6) {
        alert("Password must be at least 6 characters long.");
        isValid = false;
      }

      // Internship deadline check
      const deadline = form.querySelector("input[type='date']");
      if (deadline) {
        const today = new Date().toISOString().split("T")[0];
        if (deadline.value < today) {
          alert("Deadline cannot be in the past.");
          isValid = false;
        }
      }

      // Block form submit if invalid
      if (!isValid) {
        e.preventDefault();
      }
    });
  });
});
