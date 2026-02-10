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
    return ContentService.createTextOutput(JSON.stringify({ version: '1.3 - Broadcasts Enabled' })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getBroadcasts') {
    return getBroadcasts();
  }

  return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid Action Received: ' + action })).setMimeType(ContentService.MimeType.JSON);
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
      if (data.action === 'saveBroadcast') return saveBroadcast(data);
      if (data.action === 'deleteBroadcast') return deleteBroadcast(data);
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

  // Columns: Date, Username, Password, Name, Company, Role, Status, Mobile, Whatsapp, Email, Address, PaymentMode
  // Ensure we capture "Name" separately if provided, or fallback to username
  const name = data.name || data.username;
  
  sheet.appendRow([
    new Date(), 
    data.username, 
    data.password, 
    name, 
    data.company, 
    'user', 
    'pending', 
    "'" + (data.mobile || ''),
    "'" + (data.whatsapp || ''),
    data.email, 
    data.address,
    data.paymentMode,
    data.profileImage || ''
  ]);
  
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
    sheet.appendRow(['Date', 'Username', 'Password', 'Name', 'Company', 'Role', 'Status', 'Mobile', 'Whatsapp', 'Email', 'Address', 'PaymentMode', 'ProfileImage']);
    // Default Admin
    sheet.appendRow([new Date(), 'admin', 'admin123', 'Super Admin', 'System', 'admin', 'active', '', '', '', '', '', '']);
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

  if (!ss.getSheetByName('VisitorLog')) {
    const sheet = ss.insertSheet('VisitorLog');
    sheet.appendRow(['Timestamp', 'Date', 'Type']);
  }

  if (!ss.getSheetByName('Broadcasts')) {
    const sheet = ss.insertSheet('Broadcasts');
    // Date, Message, Duration, Expiry, UserName, Company, Contact
    sheet.appendRow(['Date', 'Message', 'Duration', 'Expiry', 'UserName', 'Company', 'Contact', 'Status']);
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
  const visitorId = data.visitorId || 'legacy';
  
  // Columns: Timestamp, Date, Type, VisitorID
  sheet.appendRow([now.toISOString(), "'" + dateStr, 'Visit', visitorId]);
  
  return getVisitorStats();
}

function getVisitorStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('VisitorLog');
  if (!sheet) return response({ success: true, stats: { online: 0, today: 0, yesterday: 0, week: 0, month: 0 } });
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return response({ success: true, stats: { online: 0, today: 0, yesterday: 0, week: 0, month: 0 } });
  
  const now = new Date();
  const todayStr = Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = Utilities.formatDate(yesterday, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
  
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); 
  
  // Track Unique Sets
  const onlineSet = new Set(); // For Online (Last 5 mins)
  const todaySet = new Set(); // For Today (Unique Daily Visitors)
  const weekSet = new Set();  // For Week (Unique Weekly Visitors)
  const monthSet = new Set(); // For Month (Unique Monthly Visitors)
  
  // Fallback counters if VisitorID is missing (legacy data)
  let legacyOnline = 0;
  
  for (let i = data.length - 1; i >= 1; i--) {
     const row = data[i];
     const tsStr = row[0];
     let dStr = row[1]; 
     const vId = row[3]; // VisitorID in Col 4
     
     if (dStr instanceof Date) {
        dStr = Utilities.formatDate(dStr, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
     } else {
        dStr = String(dStr).replace(/'/g, ''); 
     }
     
     const ts = new Date(tsStr);
     const isOnline = (now - ts < 300000);
     
     // 1. Online Calculation
     if (isOnline) {
       if (vId) onlineSet.add(vId);
       else legacyOnline++; // Count rows without ID as distinct hits
     }
     
     // 2. Historical Stats
     // We can choose: Count Visits (hits) OR Unique IDs.
     // Standard "Visitor Counter" often counts Visits (hits), "Online" counts Users.
     // But user asked for "Actual Nos" (People).
     // Let's mix: 
     // For "Today", usually we want Unique Visitors.
     // If we switch everything to Unique IDs:
     
     if (vId) {
         if (dStr === todayStr) todaySet.add(vId);
         // For rolling windows, we track ID. 
         // Note: A user visiting yesterday AND today counts as 1 "Monthly Visitor"? 
         // Or do we count daily unique sessions sum?
         // "Weekly Visitors" usually means Unique Users in that week.
         if (ts > oneWeekAgo) weekSet.add(vId);
         if (ts > oneMonthAgo) monthSet.add(vId);
     }
     
     // Legacy Handling (No ID):
     // If no ID, we can't dedup. Just add to a "legacy count"?
     // Or just ignore legacy data for strict "Unique" mode?
     // Let's rely on backend 'visits' count for historical if ID missing?
     // Complicated. Let's simplify:
     // Start counting Unique FROM NOW. Old data (today) lacks ID, will be ignored by Set logic?
     // If vId is missing/undefined, we can't use Set.
     // FIX: If vId missing, treat each row as unique (append unique suffix or similar logic?)
     // Actually, simpler: Count *Hits* for historical stats (as before), but *Unique IDs* for Online.
     // This is the safest hybrid. "Online" is the real-time presence.
     // User specifically complained about "Online 4 connections".
  }
  
  // Hybrid Approach:
  // Online: Unique Set size + legacy hits
  // Others: Keep as hit counts (loop again or keep counters)
  // Re-looping for counters is cleaner if we separate logic.
  
  // Let's refine the loop to do both correctly.
  
  let todayHits = 0;
  let yestHits = 0;
  let weekHits = 0;
  let monthHits = 0;
  
  for (let i = data.length - 1; i >= 1; i--) {
     const row = data[i];
     const tsStr = row[0];
     let dStr = row[1];
     if (dStr instanceof Date) dStr = Utilities.formatDate(dStr, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
     else dStr = String(dStr).replace(/'/g, '');
     
     const ts = new Date(tsStr);
     
     // Historical Hits (Status Quo)
     if (dStr === todayStr) todayHits++;
     if (dStr === yesterdayStr) yestHits++;
     if (ts > oneWeekAgo) weekHits++;
     if (ts > oneMonthAgo) monthHits++;
  }

  // Current Online Users (Strict Unique)
  // Because "Online" is instantaneous state.
  const onlineCount = onlineSet.size + legacyOnline;

  return response({ 
    success: true, 
    stats: { 
      online: Math.max(onlineCount, 1), 
      today: todayHits, 
      yesterday: yestHits, 
      week: weekHits, 
      month: monthHits 
    } 
  });
}
// --- Broadcasts ---

function saveBroadcast(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Broadcasts');
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName('Broadcasts');
  }

  // Calculate Expiry
  const now = new Date();
  let expiry = new Date();
  
  // Duration: 1 Week, 2 Weeks, 3 Weeks, 1 Month
  if (data.duration === '1 Week') expiry.setDate(now.getDate() + 7);
  else if (data.duration === '2 Weeks') expiry.setDate(now.getDate() + 14);
  else if (data.duration === '3 Weeks') expiry.setDate(now.getDate() + 21);
  else if (data.duration === '1 Month') expiry.setMonth(now.getMonth() + 1);
  else if (data.duration === '2 Months') expiry.setMonth(now.getMonth() + 2);
  else expiry.setDate(now.getDate() + 7); // Default
  
  // ID Generation (Simple Timestamp + Random)
  const id = 'bc_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);

  sheet.appendRow([
    now,
    data.message,
    data.duration,
    expiry,
    data.userName,
    data.company || '',
    data.contact || '',
    'Active',
    id // New ID column
  ]);
  
  return response({ status: 'success', message: 'Broadcast published' });
}

function deleteBroadcast(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Broadcasts');
  if (!sheet) return response({ status: 'error', message: 'Sheet not found' });
  
  const rows = sheet.getDataRange().getValues();
  // Find by ID (Col index 8)
  for (let i = 1; i < rows.length; i++) {
    // Check ID (row[8]) or loose match if column missing (fallback logic not safe, stick to ID)
    if (rows[i][8] == data.id) {
      sheet.deleteRow(i + 1);
      return response({ status: 'success', message: 'Broadcast deleted' });
    }
  }
  return response({ status: 'error', message: 'Broadcast not found' });
}

function getBroadcasts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Broadcasts');
  if (!sheet) return response({ success: true, broadcasts: [] });

  const data = sheet.getDataRange().getValues();
  const activeBroadcasts = [];
  const now = new Date();

  // Skip header
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const expiry = new Date(row[3]);
    const status = row[7];
    
    // Auto-expire check (optional: update status to Expired if old?)
    // For now just filter
    
    if (status === 'Active' && expiry > now) {
      activeBroadcasts.push({
        date: row[0],
        message: row[1],
        duration: row[2],
        expiry: row[3],
        userName: row[4],
        company: row[5],
        contact: row[6],
        id: row[8] || '' // Return ID
      });
    }
  }
  
  // Return reversed (newest first)
  return response({ success: true, broadcasts: activeBroadcasts.reverse() });
}
