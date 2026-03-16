function doGet(e) {
  const params = e ? e.parameter : {};
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
    const admin = e.parameter.admin === 'true';
    return getBroadcasts(admin);
  }

  if (action === 'getReviews') {
    return getReviews();
  }

  if (action === 'getInventoryHeaders') {
    return getInventoryHeaders();
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
      if (data.action === 'updateUserProfile') return updateUserProfile(data);
      if (data.action === 'saveBanners') return saveBanners(data);
      if (data.action === 'saveInventory') return saveInventory(data.data);
      if (data.action === 'bulkSaveInventory') return bulkSaveInventory(data);
      if (data.action === 'saveSale') return saveSale(data);
      if (data.action === 'addCategory') return addCategory(data);
      if (data.action === 'deleteCategory') return deleteCategory(data);
      if (data.action === 'saveExpense') return saveExpense(data);
      if (data.action === 'logVisit') return logVisit(data);
      if (data.action === 'saveBroadcast') return saveBroadcast(data);
      if (data.action === 'deleteBroadcast') return deleteBroadcast(data);
      if (data.action === 'getVisitorStats') return getVisitorStats();
      if (data.action === 'saveReview') return saveReview(data);
      if (data.action === 'getAllReviews') return getAllReviews();
      if (data.action === 'updateReviewStatus') return updateReviewStatus(data);
      if (data.action === 'saveInventoryHeaders') return saveInventoryHeaders(data);
      if (data.action === 'deleteInventoryHeaders') return deleteInventoryHeaders(data);
      if (data.action === 'deleteBatch') return deleteBatch(data);
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
    String(u.username).trim().toLowerCase() === String(data.username).trim().toLowerCase()
  );

  if (!user) {
    return response({ status: 'error', message: 'User not found' });
  }

  // Check password
  if (String(user.password).trim() !== String(data.password).trim()) {
    return response({ status: 'error', message: 'Invalid password' });
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
    // Extras appended after: Generation, Ram, HDD, Display, Touch, UpdateDate, Volt, CustomData
    sheet.appendRow(['Date', 'Category', 'Vendor', 'Item Name', 'Brand', 'Model', 'Quantity', 'Unit Price', 'Total', 'Paid', 'Mode', 'Balance', 'Generation', 'Ram', 'HDD', 'Display', 'Touch', 'UpdateDate', 'Volt', 'CustomData']);
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

  if (!ss.getSheetByName('Reviews')) {
    const sheet = ss.insertSheet('Reviews');
    sheet.appendRow(['Date', 'Name', 'Rating', 'Message', 'Status']);
  }

  if (!ss.getSheetByName('InventoryHeaders')) {
    const sheet = ss.insertSheet('InventoryHeaders');
    sheet.appendRow(['Username', 'Company', 'Headers']);
  }
}

// --- Reviews ---
function saveReview(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Reviews');
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName('Reviews');
  }

  sheet.appendRow([
    new Date(),
    data.name || 'Anonymous',
    data.rating || 5,
    data.message || '',
    'Pending'
  ]);

  return response({ status: 'success', message: 'Review saved successfully as Pending.' });
}

function getReviews() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Reviews');
  if (!sheet) return response({ success: true, reviews: [] });

  const data = sheet.getDataRange().getValues();
  const approvedReviews = [];

  // Skip header
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[4]; 
    if (status === 'Approved') {
      approvedReviews.push({
        date: row[0],
        name: row[1],
        rating: row[2],
        message: row[3]
      });
    }
  }

  // Return newest first
  return response({ success: true, reviews: approvedReviews.reverse() });
}

function getAllReviews() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Reviews');
  if (!sheet) return response({ success: true, reviews: [] });

  const data = sheet.getDataRange().getValues();
  const allReviews = [];

  // Skip header
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    allReviews.push({
      rowIndex: i + 1, // 1-indexed row number
      date: row[0],
      name: row[1],
      rating: row[2],
      message: row[3],
      status: row[4]
    });
  }

  // Return newest first
  return response({ success: true, reviews: allReviews.reverse() });
}

function updateReviewStatus(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Reviews');
  if (!sheet) return response({ status: 'error', message: 'Reviews sheet not found' });

  if (!data.rowIndex) return response({ status: 'error', message: 'Row index is required' });

  if (data.status === 'Delete') {
    sheet.deleteRow(data.rowIndex);
    return response({ status: 'success', message: 'Review deleted successfully' });
  } else {
    // Approve or Pending
    sheet.getRange(data.rowIndex, 5).setValue(data.status);
    return response({ status: 'success', message: 'Review status updated to ' + data.status });
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

function getInventory(username, role) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let allData = [];
  
  // Admin sees all data. Regular users see only their own data.
  if (role === 'admin' || role === 'super admin') {
    const sheets = ss.getSheets();
    for (let i = 0; i < sheets.length; i++) {
        const sName = sheets[i].getName();
        if (sName.startsWith('Inventory_') && sName !== 'InventoryHeaders') {
            allData = allData.concat(getSheetData(sName));
        }
    }
    // Include legacy Inventory sheet if it exists
    if (ss.getSheetByName('Inventory')) {
        allData = allData.concat(getSheetData('Inventory'));
    }
    return response(allData);
  } else if (username) {
    const safeUsername = String(username).trim().toLowerCase();
    const sheetName = 'Inventory_' + safeUsername;
    if (ss.getSheetByName(sheetName)) {
        allData = getSheetData(sheetName);
    }
    return response(allData);
  }
  
  // Fallback: If no role or username provided, return empty
  return response([]);
}

function saveInventory(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const username = String(data.username || 'unknown').trim().toLowerCase();
  const sheetName = 'Inventory_' + username;
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // Standard basic headers if they haven't uploaded an Excel yet
    const headers = ['Date', 'Category', 'Vendor', 'Item Name', 'Brand', 'Model', 'Quantity', 'Unit Price', 'Total', 'Paid Amount', 'Payment Mode', 'Balance', 'Generation', 'Ram', 'HDD', 'Display', 'Touch', 'UpdateDate', 'Volt', 'Batch', 'Username'];
    sheet.appendRow(headers);
  }
  
  const headers = sheet.getDataRange().getValues()[0];
  const lowerHeaders = headers.map(h => String(h).toLowerCase().trim());
  
  const lowerItem = {};
  for (const k in data) {
      lowerItem[String(k).toLowerCase().trim()] = data[k];
  }
  
  const row = lowerHeaders.map(lh => {
      if (lh === 'username') return username;
      
      // Attempt synonymous lookups just in case
      let val = '';
      if (lh === 'qty' || lh === 'quantity') val = lowerItem['qty'] !== undefined ? lowerItem['qty'] : lowerItem['quantity'];
      else if (lh === 'price' || lh === 'unit price') val = lowerItem['price'] !== undefined ? lowerItem['price'] : lowerItem['unit price'];
      else if (lh === 'vendor' || lh === 'vendor name') val = lowerItem['vendor'] !== undefined ? lowerItem['vendor'] : lowerItem['vendor name'];
      else if (lh === 'item' || lh === 'item name') val = lowerItem['item'] !== undefined ? lowerItem['item'] : lowerItem['item name'];
      else if (lh === 'paid' || lh === 'paid amount') val = lowerItem['paid'] !== undefined ? lowerItem['paid'] : lowerItem['paid amount'];
      else if (lh === 'mode' || lh === 'payment mode') val = lowerItem['mode'] !== undefined ? lowerItem['mode'] : lowerItem['payment mode'];
      else val = lowerItem[lh];
      
      val = val !== undefined ? val : '';
      return (typeof val === 'string' && val.match(/^[0-9]+$/)) ? "'" + val : val;
  });
  
  sheet.appendRow(row);
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
  
  // Duration Logic
  if (data.duration === '1 Week') expiry.setDate(now.getDate() + 7);
  else if (data.duration === '2 Weeks') expiry.setDate(now.getDate() + 14);
  else if (data.duration === '3 Weeks') expiry.setDate(now.getDate() + 21);
  else if (data.duration === '1 Month') expiry.setMonth(now.getMonth() + 1);
  else if (data.duration === '2 Months') expiry.setMonth(now.getMonth() + 2);
  else expiry.setDate(now.getDate() + 7); // Default
  
  // CHECK FOR UPDATE (Edit Mode)
  if (data.id) {
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][8] == data.id) { // ID is at index 8
        // Update specific cells
        // Row is i+1. Columns: 2=Message, 3=Duration, 4=Expiry, 5=User, 6=Company, 7=Contact
        sheet.getRange(i + 1, 2).setValue(data.message);
        sheet.getRange(i + 1, 3).setValue(data.duration);
        sheet.getRange(i + 1, 4).setValue(expiry);
        sheet.getRange(i + 1, 5).setValue(data.userName);
        sheet.getRange(i + 1, 6).setValue(data.company || '');
        sheet.getRange(i + 1, 7).setValue(data.contact || '');
        // Date (col 1) and ID (col 9) remain unchanged
        return response({ status: 'success', message: 'Broadcast updated' });
      }
    }
    // If ID provided but not found, treat as new? Or error? Let's treat as new to be safe, or just append.
  }

  // CREATE NEW
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
    id 
  ]);
  
  return response({ status: 'success', message: 'Broadcast published' });
}

function deleteBroadcast(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Broadcasts');
  if (!sheet) return response({ status: 'error', message: 'Sheet not found' });
  
  const rows = sheet.getDataRange().getValues();
  
  // Real check: Let's find exactly the matching row by ID (index 8)
  for (let i = 1; i < rows.length; i++) {
     if (rows[i][8] && data.id && rows[i][8] == data.id) {
        sheet.deleteRow(i + 1);
        return response({ status: 'success', message: 'Broadcast deleted by ID' });
     }
  }

  // Row fallback pass: Check if the ID matches the explicit row identifier '_' + (i+1)
  for (let i = 1; i < rows.length; i++) {
     if (data.id && typeof data.id === 'string' && data.id === '_' + (i + 1)) {
        if (String(rows[i][1]).trim() === String(data.message).trim()) {
            sheet.deleteRow(i + 1);
            return response({ status: 'success', message: 'Broadcast deleted by row fallback' });
        }
     }
  }

  // Deep fallback pass: Just match message exactly
  for (let i = 1; i < rows.length; i++) {
     if (String(rows[i][1]).trim() === String(data.message).trim()) {
        sheet.deleteRow(i + 1);
        return response({ status: 'success', message: 'Broadcast deleted by message fallback' });
     }
  }
  
  return response({ status: 'error', message: 'Broadcast not found' });
}

function getBroadcasts(isAdmin) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Broadcasts');
  if (!sheet) return response({ success: true, broadcasts: [] });

  const data = sheet.getDataRange().getValues();
  const returnBroadcasts = [];
  const now = new Date();

  // Skip header
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const expiry = new Date(row[3]);
    const status = row[7];
    
    // Auto-expire check (optional: update status to Expired if old?)
    // For now just filter based on isAdmin context
    const isExpired = expiry <= now;
    
    // Normal User View: Must be 'Active' AND not expired
    // Admin View: Grab everything except deliberately deleted ones
    if (isAdmin || (status === 'Active' && !isExpired)) {
      returnBroadcasts.push({
        date: row[0],
        message: row[1],
        duration: row[2],
        expiry: row[3],
        userName: row[4],
        company: row[5],
        contact: row[6],
        id: row[8] ? row[8] : '_' + (i + 1), // Give front-end explicit row identifier if ID missing
        status: status,
        isExpired: isExpired  // Crucial flag for admin UI
      });
    }
  }
  
  // Return reversed (newest first)
  return response({ success: true, broadcasts: returnBroadcasts.reverse() });
}

function bulkSaveInventory(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const username = String(data.username || 'unknown').trim().toLowerCase();
  const sheetName = 'Inventory_' + username;
  let sheet = ss.getSheetByName(sheetName);
  
  const items = data.data;
  if (!items || !items.length) return response({ status: 'error', message: 'No items provided' });
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = Object.keys(items[0]).map(k => String(k).trim());
    if (!headers.includes('Username')) headers.push('Username');
    sheet.appendRow(headers);
  }
  
  const headers = sheet.getDataRange().getValues()[0];
  const lowerHeaders = headers.map(h => String(h).toLowerCase().trim());
  
  const rows = items.map(item => {
    // Map Excel keys to lowercase for robust matching
    const lowerItem = {};
    for (const k in item) {
      lowerItem[String(k).toLowerCase().trim()] = item[k];
    }
    
    return lowerHeaders.map(lh => {
      if (lh === 'username') return username;
      let val = lowerItem[lh] !== undefined ? lowerItem[lh] : '';
      return (typeof val === 'string' && val.match(/^[0-9]+$/)) ? "'" + val : val;
    });
  });
  
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
  
  return response({ status: 'success', message: 'Bulk import successful', count: rows.length });
}

// --- Inventory Headers ---

function getInventoryHeaders() {
  const data = getSheetData('InventoryHeaders');
  // Some headers might literally be arrays converted to strings, we just return the raw dataset, 
  // letting the frontend JSON parse the 'headers' field which comes in as String.
  return response({ success: true, headers: data });
}

function saveInventoryHeaders(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('InventoryHeaders');
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName('InventoryHeaders');
  }

  const username = data.username;
  const company = data.company || '';
  const headersJSON = JSON.stringify(data.headers || []);

  const dataRange = sheet.getDataRange().getValues();
  let found = false;
  
  // Update if exists
  for (let i = 1; i < dataRange.length; i++) {
    if (String(dataRange[i][0]).trim().toLowerCase() === String(username).trim().toLowerCase()) {
      sheet.getRange(i + 1, 3).setValue(headersJSON);
      found = true;
      break;
    }
  }

  // Insert if new
  if (!found) {
    sheet.appendRow([username, company, headersJSON]);
  }

  return response({ status: 'success', message: 'Headers saved successfully' });
}

function deleteInventoryHeaders(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('InventoryHeaders');
  if (!sheet) return response({ status: 'error', message: 'No InventoryHeaders sheet found' });

  const username = data.username;
  if (!username) return response({ status: 'error', message: 'Username is required' });

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === String(username).trim().toLowerCase()) {
      sheet.deleteRow(i + 1);
      return response({ status: 'success', message: `Headers for user ${username} deleted successfully` });
    }
  }

  return response({ status: 'error', message: `User ${username} not found in headers` });
}

// --- Delete Batch ---

function deleteBatch(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const username = String(data.username || '').trim().toLowerCase();
  const batchName = data.batchName;
  
  if (!username || !batchName) return response({ status: 'error', message: 'Missing username or batch name' });
  
  const sheetName = 'Inventory_' + username;
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) return response({ status: 'error', message: 'User inventory sheet not found' });
  
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  if (values.length <= 1) return response({ status: 'success', message: 'Nothing to delete' });
  
  const headers = values[0];
  const lowerHeaders = headers.map(h => String(h).toLowerCase().trim());
  const batchColIndex = lowerHeaders.indexOf('batch');
  
  if (batchColIndex === -1) return response({ status: 'error', message: 'No batch column found in sheet' });
  
  // Delete from bottom to top so row indices don't shift during deletion
  let deletedCount = 0;
  for (let i = values.length - 1; i > 0; i--) {
     if (values[i][batchColIndex] === batchName) {
         sheet.deleteRow(i + 1); // +1 because array is 0-indexed, rows are 1-indexed
         deletedCount++;
     }
  }
  
  return response({ status: 'success', message: `Deleted ${deletedCount} rows successfully` });
}
