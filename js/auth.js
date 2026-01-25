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
    const json = await res.json();
    console.log("API response:", json);
    return json;
  } catch (err) {
    console.error("API request failed", err);
    return { success: false, message: "Network error" };
  }
}

/* ===== LOGIN ===== */
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    action: "login",
    company: document.getElementById("loginCompany").value.trim(),
    username: document.getElementById("loginUsername").value.trim(),
    password: document.getElementById("loginPassword").value.trim()
  };

  console.log("Login payload:", payload);

  if (!payload.company || !payload.username || !payload.password) {
    alert("All fields are required");
    return;
  }

  const res = await callAPI(payload);
  alert(res.message || (res.success ? "Login successful" : "Login failed"));
  if (res.success) window.location.href = "/page/admin.html";
});

/* ===== REGISTER ===== */
registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const pass = document.getElementById("regPassword").value.trim();
  const confirm = document.getElementById("regConfirmPassword").value.trim();

  if (pass !== confirm) {
    alert("Passwords do not match");
    return;
  }

  const payload = {
    action: "register",
    company: document.getElementById("regCompany").value.trim(),
    username: document.getElementById("regCustomer").value.trim(),
    password: pass
  };

  console.log("Register payload:", payload);

  if (!payload.company || !payload.username || !payload.password) {
    alert("All fields are required");
    return;
  }

  const res = await callAPI(payload);
  alert(res.message || (res.success ? "Registered successfully" : "Failed"));
});
