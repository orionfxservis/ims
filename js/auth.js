// Universal Admin Protection for admin.html
(function () {

    // Only protect admin.html
    const page = window.location.pathname.split("/").pop();
    if (page !== "admin.html") return;

    // Prevent double prompt if already authenticated
    if (sessionStorage.getItem("adminAuth") === "yes") return;

    // Load users from localStorage
    let users = JSON.parse(localStorage.getItem("userList") || "[]");
    let admin = users.find(u => u.name === "admin");

    if (!admin) {
        alert("Admin account missing!");
        window.location.href = "../index.html";
        return;
    }

    // Ask password
    let pass = prompt("Enter Admin Password:");

    if (pass !== admin.password) {
        alert("Invalid Password!");
        window.location.href = "../index.html";
        return;
    }

    // Allow access for this tab session
    sessionStorage.setItem("adminAuth", "yes");

})();
