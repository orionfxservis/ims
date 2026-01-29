function doGet(e) {
  const params = e.parameter;
  const action = params.action;
  
  if (action === 'test') {
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Connection Successful' })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getUsers') {
    const users = getSheetData('Users');
    return ContentService.createTextOutput(JSON.stringify(users)).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getBanners') {
    const banners = getSheetData('Banners');
    // Transform check: Simple list or object? Assuming simple list of objects {title, url}
    return ContentService.createTextOutput(JSON.stringify(banners)).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getInventory') {
    return getInventory();
  }

  if (action === 'getCategories') {
    return getCategories();
  }

  if (action === 'getSales') {
    return getSales();
  }

  if (action === 'getActivities') {
    return getActivities();
  }

  return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid Action' })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (e.postData) {
      const data = JSON.parse(e.postData.contents);
      
      if (data.action === 'login') return loginUser(data);
      if (data.action === 'register') return registerUser(data);
      if (data.action === 'updateUserStatus') return updateUserStatus(data);
      if (data.action === 'saveBanners') return saveBanners(data);
      if (data.action === 'saveInventory') return saveInventory(data.data);
      if (data.action === 'saveSale') return saveSale(data);
      if (data.action === 'addCategory') return addCategory(data);
      if (data.action === 'deleteCategory') return deleteCategory(data);
      if (data.action === 'test') return response({ status: 'success', message: 'Connection OK' });
    }
    
    return response({ status: 'error', message: 'Invalid Action or Method' });

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- Actions ---

function registerUser(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) setup(); // Auto setup if missing

  // Check if username exists
  const users = getSheetData('Users');
  if (users.find(u => u.username === data.username)) {
    return response({ status: 'error', message: 'Username already exists' });
  }

  // Append: Date, Username, Password, Name, Company, Role, Status, Phone
  sheet.appendRow([new Date(), data.username, data.password, data.username, data.company, 'user', 'pending', "'" + data.phone]);
  
  return response({ status: 'success', message: 'Registration successful' });
}

function loginUser(data) {
  const users = getSheetData('Users');
  
  // Robust matching: String(), trim(), and case-insensitive username
  const user = users.find(u => 
    String(u.username).trim().toLowerCase() === String(data.username).trim().toLowerCase() && 
    String(u.password).trim() === String(data.password).trim()
  );

  if (!user) {
    return response({ status: 'error', message: 'Invalid credentials' });
  }
  
  if (user.status !== 'active' && user.username !== 'admin') {
     return response({ status: 'error', message: 'Account not active. Please wait for Admin approval.' });
  }

  logActivity(user.username, 'Login', 'User logged in');
  return response({ status: 'success', user: user });
}

function updateUserStatus(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  const dataRange = sheet.getDataRange().getValues();
  
  let found = false;
  // Skip header (i=1)
  for (let i = 1; i < dataRange.length; i++) {
    if (dataRange[i][1] === data.username) { // Username is col index 1
       // Status is col index 6 (7th column)
       sheet.getRange(i + 1, 7).setValue(data.status);
       found = true;
       break;
    }
  }
  
  if (found) return response({ status: 'success', message: 'Status updated' });
  return response({ status: 'error', message: 'User not found' });
}

function saveBanners(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Banners');
  if (!sheet) {
    sheet = ss.insertSheet('Banners');
    sheet.appendRow(['Title', 'URL', 'Type']); // Header
  }
  
  // Clear existing (except header if we want to be safe, but simpler to clear all data rows)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 3).clearContent();
  }

  // Add new banners
  if (data.banners && data.banners.length > 0) {
    data.banners.forEach(b => {
      sheet.appendRow([b.title, b.url, b.type || 'main']);
    });
  }
  
  return response({ status: 'success' });
}


// --- Helpers ---

function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
      if (sheetName === 'Users') setup();
      sheet = ss.getSheetByName(sheetName);
      if (!sheet) return [];
  }

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const data = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j].toLowerCase()] = row[j]; // keys to lowercase
    }
    data.push(obj);
  }
  return data;
}

function response(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (!ss.getSheetByName('Users')) {
    const sheet = ss.insertSheet('Users');
    sheet.appendRow(['Date', 'Username', 'Password', 'Name', 'Company', 'Role', 'Status', 'Phone', 'Email', 'Address', 'ProfileImage']);
    // Default Admin
    sheet.appendRow([new Date(), 'admin', 'admin123', 'Super Admin', 'System', 'admin', 'active']);
  }
  
  if (!ss.getSheetByName('Banners')) {
    const sheet = ss.insertSheet('Banners');
    sheet.appendRow(['Title', 'URL', 'Type']);
  }
  
  if (!ss.getSheetByName('Categories')) {
    const sheet = ss.insertSheet('Categories');
    sheet.appendRow(['ID', 'Name', 'Status']);
  }

  if (!ss.getSheetByName('ActivityLog')) {
    const sheet = ss.insertSheet('ActivityLog');
    sheet.appendRow(['Date', 'User', 'Action', 'Details']);
  }

  if (!ss.getSheetByName('Inventory')) {
    const sheet = ss.insertSheet('Inventory');
    sheet.appendRow(['Date', 'Category', 'Vendor', 'Item Name', 'Brand', 'Quantity', 'Unit Price', 'Total', 'Paid', 'Mode', 'Balance']);
  }

  if (!ss.getSheetByName('Sales')) {
    const sheet = ss.insertSheet('Sales');
    sheet.appendRow(['Date', 'Item Name', 'Quantity', 'Customer', 'Price', 'Total', 'Mode']);
  }
}

// --- Activity Logging ---

// --- Inventory Functions ---

function getInventory() {
  const data = getSheetData('Inventory');
  return response(data); // Returns array of objects
}

function saveInventory(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Inventory');
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName('Inventory');
  }
  
  // Data: date, category, vendor, item, brand, qty, price, total, paid, mode, balance
  // Append Row
  sheet.appendRow([
    data.date,
    data.category,
    data.vendor,
    data.item,
    data.brand,
    "'" + data.qty, // Force string to avoid scientific notation if needed, or just data.qty
    data.price,
    data.total,
    data.paid,
    data.mode,
    data.balance
  ]);
  
  return response({ status: 'success', message: 'Inventory added' });
}

// --- Sales Functions ---

function getSales() {
  const data = getSheetData('Sales');
  return response(data);
}

function saveSale(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Sales');
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName('Sales');
  }
  
  sheet.appendRow([
    new Date(),
    data.item,
    data.qty,
    data.customer,
    data.price,
    data.qty * data.price, // Total
    'Cash' // Default mode for now
  ]);
  
  return response({ status: 'success', message: 'Sale recorded' });
}

// --- Activity Logging ---

function logActivity(user, action, details) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ActivityLog');
    if (sheet) {
      sheet.appendRow([new Date(), user, action, details]);
    }
  } catch (e) {
    // Silent fail to not disrupt main flow
    Logger.log("Error logging activity: " + e.toString());
  }
}

function getActivities() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ActivityLog');
  if (!sheet) return response({ success: true, activities: [] });

  const data = sheet.getDataRange().getValues();
  const activities = [];
  
  // Return last 20 activities (reverse order)
  // Skip header (row 0), start from end
  for (let i = data.length - 1; i >= 1 && activities.length < 20; i--) {
    activities.push({
      date: data[i][0],
      user: data[i][1],
      action: data[i][2],
      details: data[i][3]
    });
  }
  
  return response({ success: true, activities: activities });
}

// --- Category Functions ---

function getCategories() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Categories");
  if (!sheet) return response({ success: false, categories: [] });
  
  const data = sheet.getDataRange().getValues();
  const result = [];
  
  // Start from 1 to skip header
  for (let i = 1; i < data.length; i++) {
    // Check if status is Active (case insensitive check for robustness, though we write "Active")
    if (String(data[i][2]).toLowerCase() === "active") {
      result.push({
        id: data[i][0],
        name: data[i][1]
      });
    }
  }

  return response({ success: true, categories: result });
}

function addCategory(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Categories");
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName("Categories");
  }

  // Simple ID generation: Timestamp or just Row Index?
  // Let's use Timestamp for uniqueness
  const id = new Date().getTime(); 
  sheet.appendRow([id, data.categoryName, "Active"]);

  return response({ success: true, message: "Category added" });
}

function deleteCategory(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Categories");
  if (!sheet) return response({ success: false, message: "Sheet not found" });
  
  const dataRange = sheet.getDataRange().getValues();
  let found = false;

  for (let i = 1; i < dataRange.length; i++) {
    // Compare IDs (column 0)
    if (String(dataRange[i][0]) === String(data.id)) {
      // Set status to Inactive (Column 2 -> index 2, +1 for 1-based row)
      sheet.getRange(i + 1, 3).setValue("Inactive");
      found = true;
      break;
    }
  }

  if (found) return response({ success: true, message: "Category removed" });
  return response({ success: false, message: "Category not found" });
}
