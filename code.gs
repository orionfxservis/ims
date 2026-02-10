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

  if (action === 'getBroadcasts') {
    return getBroadcasts();
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
      if (data.action === 'saveBroadcast') return saveBroadcast(data);
      if (data.action === 'getVisitorStats') return getVisitorStats();
      if (data.action === 'test') return response({ status: 'success', message: 'Connection OK' });
    }
    return response({ error: 'No Data' });
  } catch (ex) {
    return response({ error: ex.toString() });
  }
}

function response(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Only header
  
  const headers = data[0];
  const results = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    results.push(obj);
  }
  return results;
}

// --- Specific Logic ---

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (!ss.getSheetByName('Users')) {
    const sheet = ss.insertSheet('Users');
    sheet.appendRow(['Timestamp', 'Company', 'Username', 'Password', 'Role', 'Status', 'Image']);
  }
  
  if (!ss.getSheetByName('Inventory')) {
    const sheet = ss.insertSheet('Inventory');
    // Align with Frontend expectations: ID, Item Name, Category, Quantity, Total, Price, Vendor, Date... 
    // Just usage flexible headers
    sheet.appendRow(['ID', 'Date', 'Category', 'Vendor', 'Item Name', 'Brand', 'Model', 'Quantity', 'Unit Price', 'Total', 'Paid', 'Balance', 'Mode', 'Notes']);
  }
  
  if (!ss.getSheetByName('Sales')) {
    const sheet = ss.insertSheet('Sales');
    sheet.appendRow(['Date', 'Item Name', 'Quantity', 'Total', 'Customer', 'User']);
  }

  if (!ss.getSheetByName('Banners')) {
    const sheet = ss.insertSheet('Banners');
    sheet.appendRow(['Type', 'Title', 'URL']);
  }

  if (!ss.getSheetByName('Categories')) {
    const sheet = ss.insertSheet('Categories');
    sheet.appendRow(['ID', 'Name']);
  }

  if (!ss.getSheetByName('Expenses')) {
    const sheet = ss.insertSheet('Expenses');
    sheet.appendRow(['Date', 'Title', 'Description', 'Amount', 'Payment Mode']);
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
  return response(getSheetData('Expenses'));
}

function saveExpense(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Expenses');
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName('Expenses');
  }
  
  sheet.appendRow([
    data.date,
    data.title,
    data.description,
    data.amount,
    data.mode
  ]);
  return response({ success: true, message: 'Expense Saved' });
}

// --- Visitor Log ---
function logVisit(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('VisitorLog');
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName('VisitorLog');
  }
  
  const now = new Date();
  sheet.appendRow([now, now.toISOString(), 'visit']);
  return getVisitorStats();
}

function getVisitorStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('VisitorLog');
  if (!sheet) return response({ success: true }); // Empty

  const data = sheet.getDataRange().getValues();
  // Filter logic similar to Frontend mock but in GS
  // Only minimal stats needed
  // This can be expanded. For now, returning success so frontend doesn't break
  return response({ success: true, message: 'Stats tracked' });
}


// --- Inventory ---
function getInventory() {
  return response(getSheetData('Inventory'));
}

function saveInventory(item) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Inventory');
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName('Inventory');
  }
  
  // Map item object to row array based on headers? Or simple append?
  // Simple append for now based on 'ID', 'Date', 'Category', 'Vendor', 'Item Name', 'Brand', 'Model', 'Quantity', 'Unit Price', 'Total', 'Paid', 'Balance', 'Mode', 'Notes'
  const row = [
    item.id || new Date().getTime(),
    item.date,
    item.category,
    item.vendor,
    item.item, // item name
    item.brand,
    item.model,
    item.qty,
    item.price,
    item.total,
    item.paid,
    item.balance,
    item.mode,
    item.notes
  ];
  
  sheet.appendRow(row);
  return response({ success: true });
}

// --- Sales ---
function getSales() {
  return response(getSheetData('Sales'));
}

function saveSale(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Sales');
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName('Sales');
  }
  
  sheet.appendRow([
    data.date,
    data.item,
    data.qty,
    data.total,
    data.customer,
    data.user
  ]);
  return response({ success: true });
}

// --- Categories ---
function getCategories() {
  return response(getSheetData('Categories'));
}

function addCategory(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Categories');
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName('Categories');
  }
  sheet.appendRow([new Date().getTime(), data.categoryName]);
  return response({ success: true });
}

function deleteCategory(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Categories');
  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == data.id) {
      sheet.deleteRow(i + 1);
      return response({ success: true });
    }
  }
  return response({ success: false, message: 'Category not found' });
}

// --- Banners ---
function saveBanners(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Banners');
  if (sheet) ss.deleteSheet(sheet);
  
  sheet = ss.insertSheet('Banners');
  sheet.appendRow(['Type', 'Title', 'URL']);
  
  data.banners.forEach(b => {
    sheet.appendRow([b.type, b.title, b.url]);
  });
  
  return response({ success: true });
}

// --- Auth ---
function loginUser(data) {
  const users = getSheetData('Users');
  const user = users.find(u => u.Username === data.username && u.Password === data.password);
  
  if (user) {
    if (user.Status === 'Approved' || user.status === 'Approved' || user.Status === 'active' || user.status === 'active') {
      return response({ status: 'success', user: { ...user, password: '' } });
    } else {
      return response({ status: 'error', message: 'Account is ' + (user.Status || user.status) });
    }
  }
  return response({ status: 'error', message: 'Invalid credentials' });
}

function registerUser(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Users');
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName('Users');
  }
  
  // Check existing
  const users = getSheetData('Users');
  if (users.find(u => u.Username === data.username)) {
    return response({ status: 'error', message: 'Username exists' });
  }
  
  sheet.appendRow([
    new Date(),
    data.company,
    data.username,
    data.password, 
    'User', 
    'Pending',
    '' // Image
  ]);
  
  return response({ status: 'success', message: 'Registration successful' });
}

function updateUserStatus(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  const rows = sheet.getDataRange().getValues();
  
  // Find user by username (col index 2)
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][2] === data.username) {
      // Update Status (col index 5)
      sheet.getRange(i + 1, 6).setValue(data.status);
      return response({ status: 'success' });
    }
  }
  return response({ status: 'error', message: 'User not found' });
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
  else expiry.setDate(now.getDate() + 7); // Default
  
  sheet.appendRow([
    now,
    data.message,
    data.duration,
    expiry,
    data.userName,
    data.company || '',
    data.contact || '',
    'Active'
  ]);
  
  return response({ status: 'success', message: 'Broadcast published' });
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
    
    if (status === 'Active' && expiry > now) {
      activeBroadcasts.push({
        date: row[0],
        message: row[1],
        duration: row[2],
        expiry: row[3],
        userName: row[4],
        company: row[5],
        contact: row[6]
      });
    }
  }
  
  // Return reversed (newest first)
  return response({ success: true, broadcasts: activeBroadcasts.reverse() });
}
