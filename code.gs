const SHEET_ID = ''; // Leave empty, script will find active spreadsheet
const SHEET_NAMES = {
  USERS: 'Users',
  BANNERS: 'Banners',
  PRODUCTS: 'Products',
  PURCHASES: 'Purchases',
  SALES: 'Sales',
  EXPENSES: 'Expenses'
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    // Setup Sheet if not exists
    setupSheets();

    switch (action) {
      case 'register':
        return registerUser(data);
      case 'login':
        return loginUser(data);
      case 'getUsers':
        return getUsers();
      case 'updateUserStatus':
        return updateUserStatus(data); // Approve/Lock/Delete etc
      case 'getBanners':
        return getBanners();
      case 'saveBanner':
        return saveBanner(data);
      case 'savePurchase':
        return savePurchase(data);
      case 'saveSale':
        return saveSale(data);
      case 'saveExpense':
        return saveExpense(data);
      case 'getExpenseData':
        return getExpenseData();
      case 'getPurchaseData':
        return getPurchaseData();
      case 'getSalesData':
        return getSalesData();
      case 'getStats':
        return getStats();
      default:
        return response({ success: false, message: 'Invalid action' });
    }
  } catch (error) {
    return response({ success: false, message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function response(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Users Sheet
  let userSheet = ss.getSheetByName(SHEET_NAMES.USERS);
  if (!userSheet) {
    userSheet = ss.insertSheet(SHEET_NAMES.USERS);
    userSheet.appendRow(['Timestamp', 'Name', 'Username', 'Password', 'Role', 'Status']); // Headers
  }
    
  // Banners Sheet
  let bannerSheet = ss.getSheetByName(SHEET_NAMES.BANNERS);
  if (!bannerSheet) {
    bannerSheet = ss.insertSheet(SHEET_NAMES.BANNERS);
    bannerSheet.appendRow(['Timestamp', 'ImageURL', 'Status']);
  }

  // Purchases Sheet
  let purchaseSheet = ss.getSheetByName(SHEET_NAMES.PURCHASES);
  if (!purchaseSheet) {
    purchaseSheet = ss.insertSheet(SHEET_NAMES.PURCHASES);
    // Matching purchase.html fields
    purchaseSheet.appendRow(['Timestamp', 'Date', 'VendorNo', 'VendorName', 'ProductName', 'Brand', 'Model', 'Detail', 'Quantity', 'Price', 'Total', 'PaymentMode', 'Paid', 'Balance']);
  }

  // Sales and Expenses (Basic setup for stats to work)
  let salesSheet = ss.getSheetByName(SHEET_NAMES.SALES);
  if (!salesSheet) {
    salesSheet = ss.insertSheet(SHEET_NAMES.SALES);
    salesSheet.appendRow(['Timestamp', 'CustomerName', 'Mobile', 'Product', 'Price', 'Quantity', 'Total', 'Date']);
  }

  let expenseSheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
  if (!expenseSheet) {
    expenseSheet = ss.insertSheet(SHEET_NAMES.EXPENSES);
    expenseSheet.appendRow(['Timestamp', 'Title', 'Category', 'Amount', 'Date', 'Description']);
  }
}

function registerUser(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.USERS);
  
  // Check duplicates
  const users = sheet.getDataRange().getValues();
  for (let i = 1; i < users.length; i++) {
    if (users[i][2] === data.username) {
      return response({ success: false, message: 'Username already exists' });
    }
  }

  sheet.appendRow([
    new Date(),
    data.name,
    data.username,
    data.password, // In prod, hash this!
    'USER',
    'Pending'
  ]);

  return response({ success: true, message: 'Registration successful' });
}

function loginUser(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.USERS);
  const users = sheet.getDataRange().getValues();

  const inputUser = data.username.toString().trim().toLowerCase();
  const inputPass = data.password.toString().trim(); // Trim password too
  
  let foundUser = null;

  // 1. Find User by Username First
  for (let i = 1; i < users.length; i++) {
    const user = users[i];
    const sheetUser = user[2].toString().trim().toLowerCase();
    
    if (sheetUser === inputUser) {
      foundUser = user;
      break; 
    }
  }

  // Admin backdoor (Check this regardless if user found in sheet or not, 
  // though usually admin isn't in sheet? If admin IS in sheet, sheet takes precedence 
  // unless we check this first. The original code checked this LAST. I will keep it LAST
  // but if "admin" is not in sheet, we shouldn't fail early.)
  
  if (foundUser) {
      // 2. Check Password
      const sheetPass = foundUser[3].toString().trim(); // Trim sheet password too just in case
      
      if (sheetPass !== inputPass) {
          return response({ success: false, message: 'Invalid Password' });
      }

      // 3. Check Status
      const status = foundUser[5];
      if (status === 'Pending') return response({ success: false, message: 'Account Pending Approval' });
      if (status === 'Locked') return response({ success: false, message: 'Account Locked' });
      if (status === 'Rejected') return response({ success: false, message: 'Account Rejected' });
      
      return response({ 
        success: true, 
        user: { 
          name: foundUser[1], 
          username: foundUser[2], // Return original case
          role: foundUser[4],
          status: foundUser[5]
        } 
      });
  }

  // Admin backdoor for initial setup
  if (data.username === 'admin' && data.password === 'admin123') {
     return response({ success: true, user: { name: 'Admin', username: 'admin', role: 'ADMIN', status: 'Approved' } });
  }

  return response({ success: false, message: 'User not found' });
}

function getUsers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues(); // Includes headers
  const users = [];
  
  // Skip header
  for (let i = 1; i < data.length; i++) {
     users.push({
       rowIndex: i + 1, // for updates
       timestamp: data[i][0],
       name: data[i][1],
       username: data[i][2],
       role: data[i][4],
       status: data[i][5]
     });
  }
  
  return response({ success: true, users: users });
}

function updateUserStatus(data) {
   const ss = SpreadsheetApp.getActiveSpreadsheet();
   const sheet = ss.getSheetByName(SHEET_NAMES.USERS);
   
   // Direct row access is risky if sorting happens, but standard for simple sheets
   // Better: Find by username again
   const users = sheet.getDataRange().getValues();
   let rowIndex = -1;
   
   for (let i = 1; i < users.length; i++) {
     if (users[i][2] === data.username) {
       rowIndex = i + 1;
       break;
     }
   }
   
   if (rowIndex === -1) return response({ success: false, message: 'User not found' });
   
   // Update Status Column (F = 6)
   if (data.newStatus) sheet.getRange(rowIndex, 6).setValue(data.newStatus);
   
   // Update Password (D = 4)
   if (data.newPassword) sheet.getRange(rowIndex, 4).setValue(data.newPassword);
   
   // Delete
   if (data.deleteUser) {
     sheet.deleteRow(rowIndex);
     return response({ success: true, message: 'User deleted' });
   }

   return response({ success: true });
}

function getBanners() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.BANNERS);
  if (!sheet) return response({ success: true, bannerUrl: null });

  const data = sheet.getDataRange().getValues();
  // Get last active banner
  // Assuming simpler logic: The last row is the active one for now, or filter by status
  if (data.length <= 1) return response({ success: true, bannerUrl: null });

  // Return the last added banner URL
  const lastRow = data[data.length - 1];
  return response({ success: true, bannerUrl: lastRow[1] });
}

function saveBanner(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.BANNERS);
  if (!sheet) {
    setupSheets();
    sheet = ss.getSheetByName(SHEET_NAMES.BANNERS);
  }
  
  sheet.appendRow([new Date(), data.url, 'Active']);
  return response({ success: true, message: 'Banner updated' });
}

function savePurchase(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.PURCHASES);
  if (!sheet) {
    setupSheets();
    sheet = ss.getSheetByName(SHEET_NAMES.PURCHASES);
  }

  // 'Timestamp', 'Date', 'VendorNo', 'VendorName', 'ProductName', 'Brand', 'Model', 'Detail', 'Quantity', 'Price', 'Total', 'PaymentMode', 'Paid', 'Balance'
  const total = (Number(data.quantity) || 0) * (Number(data.price) || 0);
  const balance = total - (Number(data.paid) || 0);

  sheet.appendRow([
    new Date(),
    data.date,
    data.vendorNo,
    data.vendorName,
    data.productName,
    data.brand,
    data.model,
    data.productDetail,
    data.quantity,
    data.price,
    total,
    data.paymentMode,
    data.paid,
    balance
  ]);

  return response({ success: true, message: 'Purchase saved successfully' });
}

function saveSale(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.SALES);
  if (!sheet) {
    setupSheets();
    sheet = ss.getSheetByName(SHEET_NAMES.SALES);
  }

  // 'Timestamp', 'CustomerName', 'Mobile', 'Product', 'Price', 'Quantity', 'Total', 'Date', 'PaymentMode', 'Paid', 'Balance'
  
  // Ensure headers match if adding new columns
  // If sheet exists but old headers, we might just append. 
  // Ideally, valid row structure:
  // [Timestamp, Customer, Mobile, Product, Price, Qty, Total, Date, PayMode, Paid, Balance]
  
  sheet.appendRow([
    new Date(),
    data.customerName,
    data.mobile,
    data.productName,
    data.price,
    data.quantity,
    data.total,
    data.date,
    data.paymentMode,
    data.paid,
    data.balance
  ]);

  return response({ success: true, message: 'Sale saved successfully' });
}

function saveExpense(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
  if (!sheet) {
    setupSheets();
    sheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
  }

  // Columns: 'Timestamp', 'Title', 'Category', 'Amount', 'Date', 'Description', 'PaymentMode'
  // Note: We are appending 'PaymentMode' to the end.
  // Existing data might have 6 columns.
  
  sheet.appendRow([
    new Date(),
    data.title,
    data.category,
    data.amount,
    data.date,
    data.description,
    data.paymentMode
  ]);

  return response({ success: true, message: 'Expense saved successfully' });
}

function getExpenseData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
  if (!sheet) return response({ success: true, data: [] });

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return response({ success: true, data: [] });

  // Map rows to objects
  // Columns: 0:Timestamp, 1:Title, 2:Category, 3:Amount, 4:Date
  const expenses = rows.slice(1).map(row => ({
    date: row[4], // Date column
    title: row[1], // Expense Head / Title
    amount: Number(row[3]) || 0
  }));

  return response({ success: true, data: expenses });
}

function getSalesData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.SALES);
  if (!sheet) return response({ success: true, data: [] });

  const rows = sheet.getDataRange().getValues();
  // Expecting header row 1
  if (rows.length < 2) return response({ success: true, data: [] });

  // Map rows to objects
  // Assuming column structure: 
  // 0:Time, 1:Customer, 2:Mobile, 3:Product, 4:Price, 5:Qty, 6:Total, 7:Date
  // Note: saveSale uses specific order. We should align.
  
  // Map rows to objects
  // 0:Time, 1:Customer, 2:Mobile, 3:Product, 4:Price, 5:Qty, 6:Total, 7:Date, 8:PaymentMode, 9:Paid, 10:Balance
  
  const sales = rows.slice(1).map(row => ({
    date: row[7], // Date
    customer: row[1],
    product: row[3],
    total: Number(row[6]) || 0
  }));

  return response({ success: true, data: sales });
}

function getPurchaseData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.PURCHASES);
  if (!sheet) return response({ success: true, data: [] });

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return response({ success: true, data: [] });

  // Columns: 
  // 0:Timestamp, 1:Date, 2:VendorNo, 3:VendorName, 4:ProductName, 5:Brand, 6:Model, 
  // 7:Detail, 8:Qty, 9:Price, 10:Total, 11:PayMode, 12:Paid, 13:Balance

  const purchases = rows.slice(1).map(row => ({
    date: row[1],
    vendor: row[3],
    product: row[4],
    amount: Number(row[10]) || 0 // Total Amount
  }));

  return response({ success: true, data: purchases });
}

function getStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  let totalPurchases = 0;
  let totalSales = 0;
  let totalExpenses = 0;

  // 1. Calculate Purchases (Sum Column K/11 - Total Amount)
  const pSheet = ss.getSheetByName(SHEET_NAMES.PURCHASES);
  if (pSheet && pSheet.getLastRow() > 1) {
     const pData = pSheet.getRange(2, 11, pSheet.getLastRow() - 1).getValues(); 
     totalPurchases = pData.flat().reduce((sum, val) => sum + (Number(val) || 0), 0);
  }

  // 2. Calculate Sales (Sum Column G/7 - Total Amount)
  const sSheet = ss.getSheetByName(SHEET_NAMES.SALES);
  if (sSheet && sSheet.getLastRow() > 1) {
     const sData = sSheet.getRange(2, 7, sSheet.getLastRow() - 1).getValues();
     totalSales = sData.flat().reduce((sum, val) => sum + (Number(val) || 0), 0);
  }

  // 3. Calculate Expenses (Sum Column D/4 - Amount)
  const eSheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
  if (eSheet && eSheet.getLastRow() > 1) {
     const eData = eSheet.getRange(2, 4, eSheet.getLastRow() - 1).getValues();
     totalExpenses = eData.flat().reduce((sum, val) => sum + (Number(val) || 0), 0);
  }

  return response({ 
    success: true, 
    stats: {
      purchases: totalPurchases,
      sales: totalSales,
      expenses: totalExpenses
    }
  });
}
