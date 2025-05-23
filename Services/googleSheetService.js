import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// Get __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const auth = new GoogleAuth({
  keyFile: path.join(__dirname, '../Config/google-service-account.json'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

export async function writeToItemSheet(itemName, dataRow = [], addHeader = false, siteNames = []) {

  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetNames = sheetMeta.data.sheets.map(sheet => sheet.properties.title);

  if (!sheetNames.includes(itemName)) {
    // Create new sheet/tab
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: itemName },
            },
          },
        ],
      },
    });

    // Write the header row if specified
    if (addHeader && siteNames.length > 0) {
      const headerRow = ['Date', 'Time', ...siteNames];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${itemName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headerRow],
        },
      });
    }
  }

  // If there's a row to add, append it
  if (dataRow.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${itemName}!A2`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [dataRow],
      },
    });
  }
}

export async function appendInventoryUpdateRow(itemName, updatedQty, siteNames) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];

  // Get all rows starting from A2 (skip header)
  const range = `${itemName}!A2:Z1000`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
    majorDimension: 'ROWS',
  });

  const rows = response.data.values || [];
  const lastRow = rows.length ? rows[rows.length - 1] : [];

  // Extract retained site values starting from column index 3 (A=0, so Main Inventory = index 2)
  const retainedSites = siteNames.map((_, idx) => {
    const val = lastRow[3 + idx]; // Site columns start from 3rd index
    return val !== undefined ? parseInt(val) || 0 : 0;
  });

  const newRow = [dateStr, timeStr, updatedQty, ...retainedSites];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${itemName}!A2`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [newRow],
    },
  });
}

export async function deleteItemSheet(itemName) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  // Get all sheet metadata to find the sheet ID
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const targetSheet = meta.data.sheets.find(sheet => sheet.properties.title === itemName);

  if (!targetSheet) {
    console.warn(`[Sheet] No sheet found for "${itemName}" — skipping delete`);
    return;
  }

  const sheetId = targetSheet.properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteSheet: {
            sheetId: sheetId,
          },
        },
      ],
    },
  });

  console.log(`[Sheet] Sheet "${itemName}" deleted`);
}

export async function recordItemTransferInSheet(itemName, siteNames, fromSiteName, toSiteName, quantity) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];

  const range = `${itemName}!A2:Z1000`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
    majorDimension: 'ROWS',
  });

  const rows = response.data.values || [];
  const lastRow = rows.length ? rows[rows.length - 1] : [];

  // Get current quantities
  let mainInventory = lastRow[2] !== undefined ? parseInt(lastRow[2]) || 0 : 0;

  const updatedSiteQuantities = siteNames.map((site, idx) => {
    let val = lastRow[3 + idx];
    val = val !== undefined ? parseInt(val) || 0 : 0;

    if (site === fromSiteName) {
      val -= quantity;
    }
    if (site === toSiteName) {
      val += quantity;
    }

    return Math.max(0, val); // prevent negative values
  });

  // Recalculate main inventory if needed
  const fromIsMain = fromSiteName === 'Store Room';
  const toIsMain = toSiteName === 'Store Room';

  if (fromIsMain) mainInventory -= quantity;
  if (toIsMain) mainInventory += quantity;

  const newRow = [dateStr, timeStr, mainInventory, ...updatedSiteQuantities];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${itemName}!A2`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [newRow],
    },
  });
}

export async function addSiteToAllItemSheets(newSiteName) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  // Fetch all sheet names
  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const itemSheets = sheetMeta.data.sheets.map(sheet => sheet.properties.title);

  for (const itemName of itemSheets) {
    try {
      // 1. Get header row
      const headerRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${itemName}!A1:Z1`,
      });

      const currentHeader = headerRes.data.values?.[0] || [];
      const alreadyHas = currentHeader.includes(newSiteName);
      if (alreadyHas) continue;

      // 2. Add new column to header
      currentHeader.push(newSiteName);
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${itemName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [currentHeader],
        },
      });

      // 3. Get last data row
      const dataRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${itemName}!A2:Z1000`,
      });

      const rows = dataRes.data.values || [];
      const lastRow = rows.length ? rows[rows.length - 1] : [];
      const newRow = [...lastRow];

      // Pad the row to match the new header length
      while (newRow.length < currentHeader.length - 1) newRow.push('');
      newRow.push(0);
      const cleanedRow = newRow.map((val, idx) => {
        // Treat columns after Main Inventory as numbers if possible
        if (idx >= 2 && !isNaN(val)) return Number(val);
        return val;
      });
      

      // 4. Append new row
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${itemName}!A2`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [cleanedRow],
        },
      });

    } catch (err) {
      console.error(`[Sheets] Failed updating item sheet "${itemName}": ${err.message}`);
    }
  }
}
