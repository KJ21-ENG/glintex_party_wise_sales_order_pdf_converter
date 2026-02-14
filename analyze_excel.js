
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

// Path to the file
const filePath = './temp_ref/TELLY FILE Sales Orders.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON to see the structure
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Output the first 15 rows to get a good sense of the header and data
    console.log('First 15 rows of the Excel file:');
    console.log(JSON.stringify(jsonData.slice(0, 15), null, 2));

} catch (error) {
    console.error('Error reading Excel file:', error);
}
