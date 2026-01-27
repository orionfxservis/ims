function doGet(e) {
  return HtmlService.createHtmlOutput("Inventory Management System Backend is Running");
}

/* 
  TABLE STRUCTURE (Google Sheet):
  Sheet Name: "Users"
  Columns: [Timestamp, Company Name, Username, Password, Role, Status]
  
  Sheet Name: "Inventory"
  Columns: [ID, Item Name, Category, Quantity, Price, Supplier]
*/

function registerUser(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ws = ss.getSheetByName("Users") || ss.insertSheet("Users");
  
  // Check if user exists
  const users = ws.getDataRange().getValues();
  for(let i=1; i<users.length; i++) {
    if(users[i][2] === data.username) {
      return { success: false, message: "Username already taken" };
    }
  }
  
  // Add User
  ws.appendRow([
    new Date(),
    data.company,
    data.username,
    data.password, 
    "User", // Default role
    "Pending" // Default status
  ]);
  
  return { success: true, message: "Registration successful. Wait for Admin approval." };
}

function loginUser(username, password) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ws = ss.getSheetByName("Users");
  if(!ws) return { success: false, message: "System error: User DB not found" };
  
  const data = ws.getDataRange().getValues();
  
  for(let i=1; i<data.length; i++) {
    const row = data[i];
    if(row[2] === username && row[3] === password) {
      if(row[5] === "Approved") {
        return { success: true, token: "dummy_token_"+username, role: row[4] };
      } else {
        return { success: false, message: "Account is " + row[5] };
      }
    }
  }
  
  return { success: false, message: "Invalid username or password" };
}
