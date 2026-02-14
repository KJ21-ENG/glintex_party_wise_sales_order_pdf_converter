
import * as XLSX from 'xlsx';

/**
 * Parses the Tally-style Sales Order Excel file.
 * Groups data by "Party's Name".
 * 
 * @param {ArrayBuffer} fileBuffer - The ArrayBuffer of the uploaded file.
 * @returns {Promise<{companyName: string, reportTitle: string, period: string, data: Object}>}
 */
export const parseExcel = async (fileBuffer) => {
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with header: 1 to get array of arrays
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    let companyName = "Unknown Company";
    let reportTitle = "Sales Orders";
    let reportPeriod = "";
    let headerRowIndex = -1;

    // 1. Detect Header Row and Metadata
    for (let i = 0; i < Math.min(20, rawData.length); i++) {
        const row = rawData[i];
        // Simple checks for metadata (usually top rows)
        if (i === 0 && row.length > 0) companyName = row[0];
        if (i === 1 && row.length > 0) reportTitle = row[0];
        if (i === 2 && row.length > 0) reportPeriod = row[0];

        // Check for specific columns to identify header row
        // Tally format usually has: Date, Order Number, Party's Name, Name of Item, etc.
        const rowString = row.join(' ').toLowerCase();
        if (rowString.includes("date") && rowString.includes("order") && rowString.includes("party's name")) {
            headerRowIndex = i;
            break;
        }
    }

    if (headerRowIndex === -1) {
        throw new Error("Could not detect the table header row. Make sure the sheet includes columns like Party's Name, Order Number, Name of Item, Ordered Quantity, Balance Quantity.");
    }

    // Define column indices based on header row
    const headerRow = rawData[headerRowIndex];

    // Helper to find index safely
    const findIndex = (keywords) => headerRow.findIndex(cell =>
        cell && keywords.some(k => cell.toString().toLowerCase().includes(k))
    );

    const colIndices = {
        date: findIndex(['date']),
        orderNo: findIndex(['order', 'number']),
        partyName: findIndex(['party', 'name']),
        itemName: findIndex(['item', 'particulars']),
        orderedQty: findIndex(['ordered', 'quantity']),
        balanceQty: findIndex(['balance']),
        rate: findIndex(['rate']),
        dueOn: findIndex(['due on']),
        overdue: findIndex(['overdue'])
    };

    // 2. Extract and Group Data
    const groupedData = {};

    // Start from the row AFTER the header
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        // Tally exports often have merged cells or empty cells for grouped data
        // But the "Series of order numbers" requirement implies we might need to handle per-row data carefully.
        // Based on the sample structure provided in the prompt's description ("currently it's following a series of order numbers"),
        // it implies flat list or semi-structured list.

        // Key Fields
        const partyName = row[colIndices.partyName];

        // Skip rows that look like subtotals or empty filler
        if (!partyName || typeof partyName !== 'string' || partyName.includes('Sales Orders Outstanding')) {
            continue;
        }

        // Initialize group if not exists
        if (!groupedData[partyName]) {
            groupedData[partyName] = [];
        }

        // Extract row data
        // Depending on the exact structure, some fields might be empty if it's a "continuation" line (e.g. same order, multiple items).
        // The prompt says "first party name, under it list of its sales orders".
        // We will treat every row with a valid Party Name as a record.

        const record = {
            date: parseDate(row[colIndices.date]),
            orderNo: row[colIndices.orderNo] || '',
            itemName: row[colIndices.itemName] || '',
            orderedQty: parseFloat(row[colIndices.orderedQty]) || 0,
            balanceQty: parseFloat(row[colIndices.balanceQty]) || 0,
            rate: parseFloat(row[colIndices.rate]) || 0,
            dueOn: parseDate(row[colIndices.dueOn]),
            overdue: row[colIndices.overdue] || ''
        };

        // calculate value if missing (Balance * Rate)
        // Tally might provide it, but let's recalculate for consistency if needed or extract if a column exists.
        // Let's rely on what we have.
        record.value = record.balanceQty * record.rate;

        groupedData[partyName].push(record);
    }

    // 3. Sort Parties Alphabetically
    const sortedParties = Object.keys(groupedData).sort();

    const finalData = sortedParties.map(party => ({
        partyName: party,
        orders: groupedData[party]
    }));

    return {
        companyName,
        reportTitle,
        period: reportPeriod,
        data: finalData
    };
};

// Helper for Tally dates (which might be strings like "1-Apr-2025" or Excel serials)
const parseDate = (val) => {
    if (!val) return '';
    if (typeof val === 'number') {
        // Excel serial date
        const date = XLSX.SSF.parse_date_code(val);
        return `${date.d}-${date.m}-${date.y}`;
    }
    return val.toString();
};
