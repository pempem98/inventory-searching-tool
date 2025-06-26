require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3001;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const POLLING_INTERVAL = 300000;
const HEADER_ROW_NUMBER = parseInt(process.env.HEADER_ROW_NUMBER, 10) || 1;

const allowedColumns = [
    'tòa', 'tầng', 'căn', 'mã căn', 'tổng giá bán sau vat và kpbt', 'diện tích tim tường', 
    'hướng', 'loại căn hộ', 'link ptg', 'link ảnh chỉ căn', 'loại quỹ',
];
const escapedAllowedColumns = allowedColumns.map(col => col.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
const regexPattern = new RegExp(`^\\s*(${escapedAllowedColumns.join('|')})\\s*$`, 'i');


const DB_PATH = path.join(__dirname, '..', 'data', 'sheet_data.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) console.error("Error opening database " + err.message);
    else {
        console.log("Database connected successfully.");
        db.run('CREATE TABLE IF NOT EXISTS sheet_data (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT)');
    }
});

async function pollAndCacheData() {
    console.log(`Polling data from Google Sheet... (Using row ${HEADER_ROW_NUMBER} as header)`);
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(__dirname, '..', 'credentials.json'),
            scopes: 'https://www.googleapis.com/auth/spreadsheets.readonly',
        });
        const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

        const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'FinalData!A:Z' });
        const rows = response.data.values;
        
        if (!rows || rows.length < HEADER_ROW_NUMBER) {
            console.log(`Error: Sheet has only ${rows ? rows.length : 0} rows, but HEADER_ROW_NUMBER is set to ${HEADER_ROW_NUMBER}.`);
            return;
        }

        const headerIndex = HEADER_ROW_NUMBER - 1;
        const headers = rows[headerIndex];
        const dataRows = rows.slice(HEADER_ROW_NUMBER);

        const filteredData = dataRows.map(row => {
            const rowData = {};
            headers.forEach((header, index) => {
                if (header && regexPattern.test(header)) {
                    rowData[header] = row[index] || '';
                }
            });
            return rowData;
        });
        
        const jsonDataString = JSON.stringify(filteredData);

        db.run('DELETE FROM sheet_data', () => {
            db.run('INSERT INTO sheet_data (data) VALUES (?)', [jsonDataString], (err) => {
                if (err) console.error("Error caching data to DB:", err.message);
                else console.log(`Successfully cached ${filteredData.length} rows with filtered columns.`);
            });
        });

    } catch (error) {
        console.error('Error during polling: ' + error);
    }
}

app.get('/api/data', (req, res) => {
    db.get('SELECT data FROM sheet_data ORDER BY id DESC LIMIT 1', (err, row) => {
        if (err) return res.status(500).json({ error: "Failed to read from cache." });
        if (row && row.data) res.json(JSON.parse(row.data));
        else res.status(404).json({ error: "No cached data available." });
    });
});

app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
    pollAndCacheData();
    setInterval(pollAndCacheData, POLLING_INTERVAL);
});
