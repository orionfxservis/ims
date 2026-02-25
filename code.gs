function doGet(e) {
  try {
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
      return getInventory(params.username);
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

    if (action === 'getInventoryHeaders') {
      return getInventoryHeaders();
    }

    return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid Action' })).setMimeType(ContentService.MimeType.JSON);
  } catch (ex) {
    return ContentService.createTextOutput(JSON.stringify({ error: ex.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    let data;
    
    // Check if simple string payload vs JSON vs urlencoded
    if (e.postData && e.postData.contents) {
      if (e.postData.type === 'application/x-www-form-urlencoded') {
         data = {};
         for (let key in e.parameter) {
             data[key] = e.parameter[key];
         }
      } else {
         try {
             data = JSON.parse(e.postData.contents);
         } catch(err) {
             data = e.postData.contents; // fallback
         }
      }
      
      if (data.action === 'login') return loginUser(data);
      if (data.action === 'register') return registerUser(data);
      if (data.action === 'updateUserStatus') return updateUserStatus(data);
      if (data.action === 'saveBanners') return saveBanners(data);
      if (data.action === 'saveInventory') return saveInventory(data.data, data.username);
      if (data.action === 'bulkSaveInventory') return bulkSaveInventory(data.data, data.username);
      if (data.action === 'updateInventory') return updateInventory(data.data, data.username);
      if (data.action === 'saveSale') return saveSale(data);
      if (data.action === 'addCategory') return addCategory(data);
      if (data.action === 'deleteCategory') return deleteCategory(data);
      if (data.action === 'saveExpense') return saveExpense(data);
      if (data.action === 'logVisit') return logVisit(data);
      if (data.action === 'saveBroadcast') return saveBroadcast(data);
      if (data.action === 'deleteBroadcast') return deleteBroadcast(data);
      if (data.action === 'saveInventoryHeaders') return saveInventoryHeaders(data);
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
      // Normalize keys to lowercase and trim spaces for Frontend compatibility
      const key = (headers[j] || '').toString().toLowerCase().trim();
      if (key) {
        obj[key] = row[j];
      }
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
    // New 15th Column: CustomData
    sheet.appendRow(['ID', 'Date', 'Category', 'Vendor', 'Item Name', 'Brand', 'Model', 'Quantity', 'Unit Price', 'Total', 'Paid', 'Balance', 'Mode', 'Notes', 'CustomData']);
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
    sheet.appendRow(['Timestamp', 'Date', 'Type', 'VisitorID']);
  }

  if (!ss.getSheetByName('Broadcasts')) {
    const sheet = ss.insertSheet('Broadcasts');
    // Date, Message, Duration, Expiry, UserName, Company, Contact
    sheet.appendRow(['Date', 'Message', 'Duration', 'Expiry', 'UserName', 'Company', 'Contact', 'Status']);
  }

  if (!ss.getSheetByName('InventoryHeaders')) {
    const sheet = ss.insertSheet('InventoryHeaders');
    // Username, Company, HeadersJSON
    sheet.appendRow(['Username', 'Company', 'HeadersJSON']);
  }
}

// --- Activities ---
function getActivities() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('VisitorLog');
  if (!sheet) return response({ success: true, activities: [] });
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return response({ success: true, activities: [] });
  
  const activities = [];
  const startIndex = Math.max(1, data.length - 20); // Last 20 logs
  
  for (let i = Math.max(1, data.length - 20); i < data.length; i++) {
    const row = data[i];
    activities.push({
      date: row[0],
      user: row[3] || 'Anonymous',
      action: row[2] || 'Visit',
      details: 'Accessed the application'
    });
  }
  return response({ success: true, activities: activities.reverse() });
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
  // Append Visitor ID (column 4) to track uniques
  sheet.appendRow([now, now.toISOString(), 'visit', data.visitorId || 'anonymous']);
  
  // Return updated stats immediately
  return getVisitorStats();
}

function getVisitorStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('VisitorLog');
  if (!sheet) return response({ success: true, stats: { online: 0, today: 0, yesterday: 0, week: 0, month: 0 } });

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return response({ success: true, stats: { online: 0, today: 0, yesterday: 0, week: 0, month: 0 } });

  const now = new Date();
  const timeZone = Session.getScriptTimeZone();
  const todayStr = Utilities.formatDate(now, timeZone, 'yyyy-MM-dd');
  
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = Utilities.formatDate(yesterdayDate, timeZone, 'yyyy-MM-dd');

  // This Week: Rolling 7 days (Simple & Effective for "This Week")
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Online: Last 10 minutes
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  
  // Current Calendar Month
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Use Sets to count unique visitors
  const onlineSet = new Set();
  const todaySet = new Set();
  const yesterdaySet = new Set();
  const weekSet = new Set();
  const monthSet = new Set();

  // Start from 1 to skip header
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dateObj = new Date(row[0]); 
    const id = row[3] || 'anonymous';
    
    // Skip invalid dates
    if (isNaN(dateObj.getTime())) continue;

    const rowDateStr = Utilities.formatDate(dateObj, timeZone, 'yyyy-MM-dd');

    // Online
    if (dateObj > tenMinutesAgo) {
      onlineSet.add(id);
    }

    // Today
    if (rowDateStr === todayStr) {
      todaySet.add(id);
    }

    // Yesterday
    if (rowDateStr === yesterdayStr) {
      yesterdaySet.add(id);
    }

    // This Week (Last 7 Days)
    if (dateObj > oneWeekAgo) {
      weekSet.add(id);
    }

    // This Month (Calendar Month)
    if (dateObj.getMonth() === currentMonth && dateObj.getFullYear() === currentYear) {
      monthSet.add(id);
    }
  }

  return response({
    success: true,
    stats: {
      online: onlineSet.size || 1, // Minimum 1 for active user
      today: todaySet.size,
      yesterday: yesterdaySet.size,
      week: weekSet.size,
      month: monthSet.size
    }
  });
}


// --- Inventory ---
// Helper: get or create user-specific inventory sheet
function getUserInventorySheet(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const safeName = username ? username.toString().trim() : 'Guest';
  const sheetName = 'Inventory_' + safeName;
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // Standard backend headers
    sheet.appendRow(['ID', 'Date', 'Category', 'Vendor', 'Item Name', 'Brand', 'Model', 'Quantity', 'Unit Price', 'Total', 'Paid', 'Balance', 'Mode', 'Notes', 'CustomData']);
    
    // Attempt to figure out if this user has custom headers saved
    const headersSheet = ss.getSheetByName('InventoryHeaders');
    if (headersSheet) {
      const data = headersSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
         if (data[i][0] === username) {
            try {
               const customHeadersArray = JSON.parse(data[i][2]);
               if (customHeadersArray && customHeadersArray.length > 0) {
                   // If they have explicit custom headers, let's append them starting at column 16 (P)
                   const currentHeaders = sheet.getRange(1, 1, 1, 15).getValues()[0];
                   const combined = currentHeaders.concat(customHeadersArray);
                   sheet.getRange(1, 1, 1, combined.length).setValues([combined]);
               }
            } catch(e) {}
            break;
         }
      }
    }
  }
  return sheet;
}

function getInventory(username) {
  const safeName = username ? username.toString().trim() : 'Guest';
  const results = getSheetData('Inventory_' + safeName);
  
  // getSheetData returns objects with lowercase keys natively
  // If the sheet has extended columns (e.g. from custom headers), they are already inside the object!
  // To satisfy the frontend expecting a `customData` JSON string for dynamic rendering:
  results.forEach(item => {
     // If we find columns beyond the standard 15 that aren't 'customdata', we package them
     const standardKeys = ['id', 'date', 'category', 'vendor', 'vendor name', 'item name', 'item', 'brand', 'model', 'quantity', 'qty', 'unit price', 'price', 'total', 'paid amount', 'paid', 'balance', 'payment mode', 'mode', 'notes', 'customdata'];
     const customKeysFound = {};
     let hasCustom = false;
     
     for (let key in item) {
       if (!standardKeys.includes(key)) {
         customKeysFound[key] = item[key]; // Preserve whatever string or math they put in the Google Sheet column
         hasCustom = true;
       }
     }
     
     // Only overwrite the JSON string if the spreadsheet literally had separate explicit columns for them
     if (hasCustom) {
         // 1. First unpack whatever fields were already secretly stored in the customdata payload
         let existingCustomData = {};
         if (item.customdata) {
             try { 
                 const parsed = JSON.parse(item.customdata);
                 if (typeof parsed === 'object') {
                     existingCustomData = parsed;
                 }
             } catch(e) {}
         }

         // 2. Find their original casing from InventoryHeaders so the front-end maps it exactly:
         const ss = SpreadsheetApp.getActiveSpreadsheet();
         const hSheet = ss.getSheetByName('InventoryHeaders');
         if (hSheet) {
             const hData = hSheet.getDataRange().getValues();
             let headersFound = false;
             for (let i = 1; i < hData.length; i++) {
                 if (hData[i][0] === username) {
                     try {
                         const originalHeaders = JSON.parse(hData[i][2]);
                         // Merge explicit sheet columns OVER the existing payload data
                         const correctlyCasedCustomData = { ...existingCustomData }; 
                         originalHeaders.forEach(original => {
                             const lower = original.toLowerCase().trim();
                             if (customKeysFound[lower] !== undefined) {
                                 correctlyCasedCustomData[original] = customKeysFound[lower];
                             }
                         });
                         item.customdata = JSON.stringify(correctlyCasedCustomData);
                         headersFound = true;
                     } catch(e) {}
                     break;
                 }
             }
             if (!headersFound) {
                 item.customdata = JSON.stringify({ ...existingCustomData, ...customKeysFound });
             }
         } else {
              item.customdata = JSON.stringify({ ...existingCustomData, ...customKeysFound });
         }
     }
  });

  return response(results);
}

function saveInventory(item, username) {
  const sheet = getUserInventorySheet(username);
  const targetHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Build a mapped row dynamically based on what the spreadsheet expects
  const rowTarget = Array(targetHeaders.length).fill('');
  
  const standardMap = {
     'id': item.id || new Date().getTime(),
     'date': item.date || '',
     'category': item.category || '',
     'vendor': item.vendor || '',
     'item name': item.item || '',
     'brand': item.brand || '',
     'model': item.model || '',
     'quantity': item.qty || 0,
     'unit price': item.price || 0,
     'total': item.total || 0,
     'paid': item.paid || 0,
     'balance': item.balance || 0,
     'mode': item.mode || '',
     'notes': item.notes || '',
     'customdata': item.customData || '' // We still save the fallback JSON block just in case
  };

  // Decode custom data sent by frontend to map explicitly
  let explicitCustomFields = {};
  if (item.customData) {
     try { explicitCustomFields = JSON.parse(item.customData); } catch(e) {}
  }

  // Iterate over whatever columns exist in their personalized sheet
  for (let i = 0; i < targetHeaders.length; i++) {
     const colNameLower = targetHeaders[i].toString().toLowerCase().trim();
     if (standardMap[colNameLower] !== undefined) {
         rowTarget[i] = standardMap[colNameLower];
     } else {
         // It's an extended explicit custom column
         // Search the parsed custom fields from the frontend matching the original header
         const origHeader = targetHeaders[i].toString().trim();
         if (explicitCustomFields[origHeader] !== undefined) {
             rowTarget[i] = explicitCustomFields[origHeader];
         }
     }
  }
  
  sheet.appendRow(rowTarget);
  return response({ success: true });
}

function updateInventory(item, username) {
  const sheet = getUserInventorySheet(username);
  if (!item.id) return response({ success: false, message: 'Invalid request' });
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(item.id)) {
      
      let parsedCustomFields = {};
      if (item.customData) {
         try { parsedCustomFields = JSON.parse(item.customData); } catch(e) {}
         // Also save string payload to Col 15 if it exists in schema
         if(headers[14] && headers[14].toString().toLowerCase().trim() === 'customdata') {
            sheet.getRange(i + 1, 15).setValue(item.customData);
         }
      }

      // Instead of hardcoded numbers, map based on their sheet's literal setup dynamically
      for (let colIdx = 0; colIdx < headers.length; colIdx++) {
         const colName = headers[colIdx].toString().toLowerCase().trim();
         
         // Standard Overwrites
         if (colName === 'date' && item.date !== undefined) sheet.getRange(i + 1, colIdx + 1).setValue(item.date);
         else if (colName === 'category' && item.category !== undefined) sheet.getRange(i + 1, colIdx + 1).setValue(item.category);
         else if (colName === 'vendor' && item.vendor !== undefined) sheet.getRange(i + 1, colIdx + 1).setValue(item.vendor);
         else if (colName === 'item name' && item.item !== undefined) sheet.getRange(i + 1, colIdx + 1).setValue(item.item);
         else if (colName === 'brand' && item.brand !== undefined) sheet.getRange(i + 1, colIdx + 1).setValue(item.brand);
         else if (colName === 'model' && item.model !== undefined) sheet.getRange(i + 1, colIdx + 1).setValue(item.model);
         else if ((colName === 'quantity' || colName === 'qty') && item.qty !== undefined) sheet.getRange(i + 1, colIdx + 1).setValue(item.qty);
         else if ((colName === 'unit price' || colName === 'price') && item.price !== undefined) sheet.getRange(i + 1, colIdx + 1).setValue(item.price);
         else if (colName === 'total' && item.total !== undefined) sheet.getRange(i + 1, colIdx + 1).setValue(item.total);
         else if ((colName === 'paid' || colName === 'paid amount') && item.paid !== undefined) {
             sheet.getRange(i + 1, colIdx + 1).setValue(item.paid);
             
             // Dynamic Balance recalculation
             let totalIdx = headers.findIndex(h => h.toString().toLowerCase().trim() === 'total');
             let balIdx = headers.findIndex(h => h.toString().toLowerCase().trim() === 'balance');
             if (balIdx > -1) {
                const totalVal = item.total !== undefined ? item.total : (totalIdx > -1 ? data[i][totalIdx] : 0);
                sheet.getRange(i + 1, balIdx + 1).setValue(totalVal - item.paid);
             }
         }
         else if (colName === 'mode' && item.mode !== undefined) sheet.getRange(i + 1, colIdx + 1).setValue(item.mode);
         else if (colName === 'notes' && item.notes !== undefined) sheet.getRange(i + 1, colIdx + 1).setValue(item.notes);
         
         // Custom Fields mapping (explicit columns vs JSON payload)
         else if (colName !== 'customdata') {
            const originalCasing = headers[colIdx].toString().trim();
            if (parsedCustomFields[originalCasing] !== undefined) {
                sheet.getRange(i + 1, colIdx + 1).setValue(parsedCustomFields[originalCasing]);
            }
         }
      }

      return response({ status: 'success', message: 'Inventory updated in ' + sheet.getName() });
    }
  }
  
  return response({ success: false, message: 'Item ID not found' });
}

// --- Inventory Headers ---
function getInventoryHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('InventoryHeaders');
  if (!sheet) return response({ success: true, headers: [] });
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return response({ success: true, headers: [] });
  
  const results = [];
  for (let i = 1; i < data.length; i++) {
     let parsedHeaders = [];
     try {
       parsedHeaders = data[i][2] ? JSON.parse(data[i][2]) : [];
     } catch(e) { /* ignore parse error */ }
     
     results.push({
        username: data[i][0] || '',
        company: data[i][1] || '',
        headers: parsedHeaders
     });
  }
  return response({ success: true, headers: results });
}

function saveInventoryHeaders(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('InventoryHeaders');
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName('InventoryHeaders');
  }
  
  const rows = sheet.getDataRange().getValues();
  let found = false;
  
  for (let i = 1; i < rows.length; i++) {
     if (rows[i][0] === data.username) {
        // Update existing row
        sheet.getRange(i + 1, 2).setValue(data.company || '');
        sheet.getRange(i + 1, 3).setValue(JSON.stringify(data.headers || []));
        found = true;
        break;
     }
  }
  
  if (!found) {
     sheet.appendRow([data.username, data.company || '', JSON.stringify(data.headers || [])]);
  }
  
  return response({ status: 'success', message: 'Headers saved' });
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Categories');
  if (!sheet) return response({ success: true, categories: [] });
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return response({ success: true, categories: [] });
  
  const categories = [];
  // Assuming Column 1 is Name, Column 0 might be ID or vice versa. 
  // Let's check headers first. 
  const headers = data[0].map(h => h.toString().toLowerCase());
  const nameIdx = headers.findIndex(h => h.includes('name') || h === 'category');
  const idIdx = headers.findIndex(h => h.includes('id'));
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    categories.push({
      id: idIdx >= 0 ? row[idIdx] : 'cat_' + i,
      name: nameIdx >= 0 ? row[nameIdx] : (row[1] || row[0]) // Fallback to col 1 or 0
    });
  }
  
  return response({ success: true, categories: categories });
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
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet('Banners');
  }
  
  sheet.appendRow(['Type', 'Title', 'URL']);
  
  if (data.banners && Array.isArray(data.banners)) {
    data.banners.forEach(b => {
      sheet.appendRow([b.type, b.title, b.url]);
    });
  }
  
  return response({ status: 'success', success: true });
}

// --- Auth ---
function loginUser(data) {
  const users = getSheetData('Users');
  // Use lowercase keys as getSheetData now normalizes them
  const user = users.find(u => u.username === data.username && u.password === data.password);
  
  if (user) {
    // Check Status (lowercase 'status' from normalized key)
    if (user.status === 'Approved' || user.status === 'active') {
      return response({ status: 'success', user: { ...user, password: '' } });
    } else {
      return response({ status: 'error', message: 'Account is ' + user.status });
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
  // Use lowercase 'username' check
  if (users.find(u => u.username === data.username)) {
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

function changePassword(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    // col 2 (0-indexed) is Username, col 3 is Password
    if (rows[i][2] === data.username && String(rows[i][3]) === String(data.oldPassword)) {
      sheet.getRange(i + 1, 4).setValue(data.newPassword);
      return response({ status: 'success' });
    }
  }
  return response({ status: 'error', message: 'User not found or incorrect old password' });
}

function updateUserStatus(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  const rows = sheet.getDataRange().getValues();
  
  // Find user by username (col index 2 -> C column)
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][2] === data.username) {
      // Update Status (col index 5 -> F column)
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
    const status = (row[7] || '').toString().toLowerCase();
    
    let validExpiry = true;
    if (row[3]) {
      const expDate = new Date(row[3]);
      if (!isNaN(expDate.getTime()) && expDate < now) {
         validExpiry = false; 
      }
    }
    
    // Accept anything that says active and hasn't expired
    if (status === 'active' && validExpiry) {
      activeBroadcasts.push({
        date: row[0],
        message: row[1],
        duration: row[2],
        expiry: row[3],
        userName: row[4],
        company: row[5],
        contact: row[6],
        status: row[7],
        id: row[8] ? row[8] : '_' + (i + 1) // Give front-end explicit row identifier if ID missing
      });
    }
  }
  
  // Return reversed (newest first)
  return response({ success: true, broadcasts: activeBroadcasts.reverse() });
}

function deleteBroadcast(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Broadcasts');
  if (!sheet) return response({ success: false, message: 'No broadcasts sheet' });
  
  const rows = sheet.getDataRange().getValues();
  
  // Real check: Let's find exactly the matching row by ID (index 8) or fallback to precise row index
  for (let i = 1; i < rows.length; i++) {
     // Check true ID if it exists in the sheet and in the request
     if (rows[i][8] && data.id && rows[i][8] == data.id) {
        sheet.deleteRow(i + 1);
        return response({ status: 'success', message: 'Broadcast deleted by ID' });
     }
     // Fallback: Check if the ID matches the explicit row identifier '_' + (i+1)
     if (data.id && typeof data.id === 'string' && data.id === '_' + (i + 1)) {
        // Double check message to be safe against row shifts
        if (rows[i][1] === data.message) {
            sheet.deleteRow(i + 1);
            return response({ status: 'success', message: 'Broadcast deleted by row fallback' });
        }
     }
     
     // Deep fallback: Just match message exactly
     if ((!data.id || data.id === "") && rows[i][1] === data.message) {
        sheet.deleteRow(i + 1);
        return response({ status: 'success', message: 'Broadcast deleted by message fallback' });
     }
  }
  
  return response({ status: 'error', message: 'Broadcast not found' });
}



function bulkSaveInventory(items, username) {
  try {
    const sheet = getUserInventorySheet(username);
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return response({ status: 'error', message: 'No items provided for bulk save' });
    }
    
    const targetHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Map items strictly to exactly whatever columns the user's tab expects
    const rows = items.map((data, index) => {
      const uniqueId = new Date().getTime().toString() + index.toString() + Math.floor(Math.random() * 1000).toString();
      
      const rowTarget = Array(targetHeaders.length).fill('');
      
      const standardMap = {
         'id': uniqueId,
         'date': data.date || new Date().toISOString().split('T')[0],
         'category': data.category || '',
         'vendor': data.vendor || '',
         'item name': data.item || '',
         'brand': data.brand || '',
         'model': data.model || '',
         'quantity': data.qty || 0,
         'unit price': data.price || 0,
         'total': data.total || 0,
         'paid': data.paid || 0,
         'balance': data.balance || 0,
         'mode': data.mode || '',
         'notes': data.notes || '',
         'customdata': data.customData || '' 
      };

      let explicitCustomFieldsLower = {};
      if (data.customData) {
         try { 
             const parsed = JSON.parse(data.customData); 
             for (let k in parsed) {
                 explicitCustomFieldsLower[k.trim().toLowerCase()] = parsed[k];
             }
         } catch(e) {}
      }

      for (let i = 0; i < targetHeaders.length; i++) {
         const colNameH = targetHeaders[i].toString().trim();
         const colNameLower = colNameH.toLowerCase();
         if (standardMap[colNameLower] !== undefined) {
             rowTarget[i] = standardMap[colNameLower];
         } else if (explicitCustomFieldsLower[colNameLower] !== undefined) {
             rowTarget[i] = explicitCustomFieldsLower[colNameLower];
         }
      }
      return rowTarget;
    });
    
    // Write in bulk safely matching exact column count expected by table layout
    if (rows.length > 0) {
        const lastRow = sheet.getLastRow();
        sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
    
    return response({ status: 'success', message: `Bulk saved ${rows.length} items.` });
    
  } catch (ex) {
    return response({ status: 'error', message: ex.toString() });
  }
}
