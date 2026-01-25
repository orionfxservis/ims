console.log("auth.js loaded");

const loginForm = document.getElementById("formLogin");
const registerForm = document.getElementById("formRegister");

async function callAPI(payload) {
  try {
    const res = await fetch(CONFIG.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error("API error", err);
    return { success: false, message: "Network error" };
  }
}

/* LOGIN */
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    action: "login",
    company: loginCompany.value.trim(),
    username: loginUsername.value.trim(),
    password: loginPassword.value.trim()
  };

  const result = await callAPI(payload);
  console.log("Login result:", result);

  alert(result.message || (result.success ? "Login OK" : "Login failed"));
  if (result.success) {
    // redirect or show admin page
    window.location = "/page/admin.html";
  }
});

/* REGISTER */
registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (regPassword.value !== regConfirmPassword.value) {
    alert("Passwords do not match");
    return;
  }

  const payload = {
    action: "register",
    company: regCompany.value.trim(),
    username: regCustomer.value.trim(),
    password: regPassword.value.trim()
  };

  const result = await callAPI(payload);
  alert(result.message);
});
