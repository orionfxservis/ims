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

  if (action === 'getExpenses') {
    return getExpenses();
  }

  if (action === 'getVersion') {
    return ContentService.createTextOutput(JSON.stringify({ version: '1.2' })).setMimeType(ContentService.MimeType.JSON);
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
      if (data.action === 'saveExpense') return saveExpense(data);
      if (data.action === 'logVisit') return logVisit(data);
      if (data.action === 'getVisitorStats') return getVisitorStats();
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
      // Auto-run setup if critical sheets are missing
      if (['Users', 'Inventory', 'Sales', 'Categories', 'Banners', 'Expenses'].includes(sheetName)) {
        setup();
        sheet = ss.getSheetByName(sheetName);
      }
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
    // Updated Column Order as requested: Date, Category, Vendor, Item Name, Brand, Model, Quantity, Unit Price, Total, Paid, Mode, Balance
    // Extras appended after: Generation, Ram, HDD, Display, Touch, UpdateDate, Volt
    sheet.appendRow(['Date', 'Category', 'Vendor', 'Item Name', 'Brand', 'Model', 'Quantity', 'Unit Price', 'Total', 'Paid', 'Mode', 'Balance', 'Generation', 'Ram', 'HDD', 'Display', 'Touch', 'UpdateDate', 'Volt']);
  }

  if (!ss.getSheetByName('Expenses')) {
    const sheet = ss.insertSheet('Expenses');
    sheet.appendRow(['Date', 'Title', 'Description', 'Amount', 'Mode']);
  }

  if (!ss.getSheetByName('Sales')) {
    const sheet = ss.insertSheet('Sales');
    sheet.appendRow(['Date', 'Customer Name', 'Item Name', 'Unit Price', 'Quantity', 'Total', 'Paid', 'Mode', 'Balance', 'User']);
  }
}

// --- Expenses ---

function getExpenses() {
  const data = getSheetData('Expenses');
  return response(data);
}

function saveExpense(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Expenses');
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName('Expenses');
  }
  if (!sheet) return { success: false, message: 'Expenses sheet could not be created' };
  
  sheet.appendRow([
    data.date,
    data.title,
    data.description,
    data.amount,
    data.mode
  ]);
  
  return { success: true, message: 'Expense saved' };
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
  // Append Row in Request Order
  sheet.appendRow([
    data.date,
    data.category,
    data.vendor,
  // Data: date, category, vendor, item, brand, model, qty, price, total, paid, mode, balance
  // Append Row in Request Order
  sheet.appendRow([
    data.date,
    data.category,
    data.vendor,
    data.item,
    data.brand,
    data.model || '',
    "'" + data.qty,
    data.price,
    data.total,
    data.paid,
    data.mode,
    data.balance,
    data.generation || '',
    data.ram || '',
    data.hdd || '',
    data.display || '',
    data.touch || '',
    data.updateDate || '',
    data.volt || ''
  ]);
  
  return { success: true, message: 'Item saved', item: data };
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
  
  // Header: Date, Customer, Item, Price, Qty, Total, Paid, Mode, Balance, User
  // User requested Table Order: Date, Customer, Item, Unit Price, Qty, Total, Paid, Mode, Balance
  // We will save in that order. Use ' to force string for IDs/Phone numbers if needed.
  
  sheet.appendRow([
    data.date,                  // Date
    data.customer,              // Customer Name
    data.item,                  // Item Name
    data.price,                 // Unit Price
    data.qty,                   // Quantity
    data.total,                 // Total Amount
    data.paid,                  // Amount Paid
    data.mode,                  // Payment Mode
    data.balance,               // Balance
    data.user || 'Unknown'      // User
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
    // Added trim() to handle potential whitespace issues
    if (String(data[i][2]).trim().toLowerCase() === "active") {
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

// --- Visitor Counter ---

function logVisit(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('VisitorLog');
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName('VisitorLog');
  }
  
  const now = new Date();
  const dateStr = Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
  
  sheet.appendRow([now.toISOString(), dateStr, 'Visit']);
  
  return getVisitorStats();
}

function getVisitorStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('VisitorLog');
  if (!sheet) return response({ success: true, stats: { online: 0, today: 0, yesterday: 0, week: 0, month: 0 } });
  
  const data = sheet.getDataRange().getValues();
  // Skip header
  if (data.length <= 1) return response({ success: true, stats: { online: 0, today: 0, yesterday: 0, week: 0, month: 0 } });
  
  const now = new Date();
  const todayStr = Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = Utilities.formatDate(yesterday, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
  
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  let online = 0;
  let today = 0;
  let yest = 0;
  let week = 0;
  let month = 0;
  
  // Iterate backwards for performance on very large sets, 
  // but for accurate stats we check all or until dates are too old (if sorted). 
  // AppendRow usually keeps sorted.
  
  for (let i = data.length - 1; i >= 1; i--) {
     const row = data[i];
     const tsStr = row[0];
     const dStr = row[1]; // yyyy-MM-dd
     
     const ts = new Date(tsStr);
     
     // Online: last 5 mins (300000 ms)
     if (now - ts < 300000) online++;
     
     if (dStr === todayStr) today++;
     if (dStr === yesterdayStr) yest++;
     
     if (ts > oneWeekAgo) week++;
     if (ts > oneMonthAgo) month++;
     
     // Optimization: if ts is older than 1 month, we can maybe stop? 
     // But strictly we should count everything for 'month' if it means 'this month' (calendar) or 'last 30 days'. 
     // Requirement said "This Month". Let's stick to last 30 days for simplicity or current calendar month?
     // "This Month" usually means current calendar month (e.g. Feb 1 to Feb 28).
     // Let's adjust Month logic to Calendar Month.
  }
  
  // Re-calc month for Calendar Month
  const currentMonthStr = Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), "yyyy-MM");
  month = 0; // Reset
  for (let i = 1; i < data.length; i++) {
     // Forward loop or backward doesn't matter for specific checks
     if (data[i][1].startsWith(currentMonthStr)) month++;
  }
  // Wait, I can do it in the main loop more efficiently? 
  // Let's stick to the previous loop but fix the month check.
  // Actually, let's keep it simple: 
  // Online: < 5 mins
  // Today: dateStr match
  // Yesterday: dateStr match
  // Week: last 7 days (rolling)
  // Month: current calendar month (yyyy-MM match)
  
  return response({ 
    success: true, 
    stats: { 
      online: Math.max(online, 1), // Always at least 1 (you)
      today: today, 
      yesterday: yest, 
      week: week, 
      month: month 
    } 
  });
}
