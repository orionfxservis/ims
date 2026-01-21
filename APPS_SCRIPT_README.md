# Google Apps Script Deployment Instructions

This project uses Google Sheets as a backend database. Follow these steps to set it up.

## 1. Create a Google Sheet
1. Go to [sheets.google.com](https://sheets.google.com) and create a **New Spreadsheet**.
2. Name it "IMS Database" (or anything you like).

## 2. Open Script Editor
1. In your Google Sheet, go to **Extensions** > **Apps Script**.
2. This opens the Google Apps Script editor in a new tab.

## 3. Copy the Code
1. Delete any code currently in the `Code.gs` file in the editor.
2. Open the file `code.gs` from this project folder (it's in the root directory).
3. Copy the **entire content** of `code.gs`.
4. Paste it into the Google Apps Script editor.
5. Press **Ctrl+S** (or clicking the disk icon) to Save the project. Name it "IMS API".

## 4. Deploy as Web App
1. Click the blue **Deploy** button at the top right.
2. Select **New deployment**.
3. Click the gear icon (Select type) next to "Select type" and choose **Web app**.
4. Fill in the details:
   - **Description**: "v1" (or similar)
   - **Execute as**: **Me** (your email)
   - **Who has access**: **Anyone** (This is CRITICAL. If you choose "Only myself", the app won't work).
5. Click **Deploy**.
6. You may be asked to *Authorize Access*.
   - Click "Authorize access".
   - Choose your Google account.
   - If you see "Google hasn't verified this app", click **Advanced** -> **Go to IMS API (unsafe)** -> **Allow**.

## 5. Get the URL
1. Once deployed, you will see a **Web App URL**. It starts with `https://script.google.com/...`
2. **Copy this URL**.

## 6. Connect to IMS
1. Go back to your IMS Admin Dashboard (`page/admin.html`).
2. Go to **Settings**.
3. Paste the URL into the "Web App URL" field.
4. Click **Connect & Save**.

## Troubleshooting
- If you make changes to the `code.gs` file, you must **Deploy** > **Manage deployments** > **Edit** (pencil icon) > select specific specific deployment > **New version** to update the live code. Merely saving is not enough.
- Ensure "Who has access" is always set to **Anyone**.
