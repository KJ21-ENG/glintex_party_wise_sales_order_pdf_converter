
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to format currency/values
const formatCurrency = (val) => val ? val.toFixed(2) : '-';
// Helper to format weight
const formatWeight = (val) => {
    if (!val) return '-';
    // Format with commas (Indian style: 1,23,456.789)
    const formatted = new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3
    }).format(val);
    return `${formatted} KG`;
};

// Column definitions (index-keyed)
const COL_HEADERS = ['Date', 'Order', 'Item Name', 'Ordered', 'Balance', 'Rate', 'Value', 'Due On', 'Overdue'];
const ITEM_NAME_COL = 2;
const MIN_FONT_SIZE = 6;
const BASE_FONT_SIZE = 8;
const CELL_PADDING = 3; // 2 × 1.5mm

/**
 * Measures text width in mm for a given font size.
 */
const measureTextWidth = (doc, text, fontSize) => {
    return doc.getStringUnitWidth(String(text)) * fontSize / doc.internal.scaleFactor;
};

/**
 * Calculates optimal column widths and font sizes based on actual data.
 * Returns { columns, fontSize, itemNameFontSize }
 */
const calculateColumnLayout = (doc, allOrders, availableWidth) => {
    // Collect max text per column from all data + headers
    const maxTexts = COL_HEADERS.map(h => h);

    // Build formatted cell values for each column
    const colTexts = COL_HEADERS.map(() => []);
    COL_HEADERS.forEach((h, i) => colTexts[i].push(h));

    allOrders.forEach(order => {
        const row = [
            order.date,
            order.orderNo,
            order.itemName,
            formatWeight(order.orderedQty),
            formatWeight(order.balanceQty),
            formatCurrency(order.rate),
            formatCurrency(order.value),
            order.dueOn,
            order.overdue
        ];
        row.forEach((val, i) => colTexts[i].push(String(val || '')));
    });

    // Find the longest text per column
    colTexts.forEach((texts, i) => {
        let longest = '';
        texts.forEach(t => { if (t.length > longest.length) longest = t; });
        maxTexts[i] = longest;
    });

    // Measure natural widths at base font size
    doc.setFontSize(BASE_FONT_SIZE);
    const naturalWidths = maxTexts.map(text => measureTextWidth(doc, text, BASE_FONT_SIZE) + CELL_PADDING);

    // Minimum widths to keep columns readable
    const minWidths = [18, 20, 30, 22, 22, 14, 20, 18, 20];

    // Clamp natural widths to minimums
    const clampedWidths = naturalWidths.map((w, i) => Math.max(w, minWidths[i]));

    // Sum of all fixed columns (everything except Item Name)
    const fixedColsWidth = clampedWidths.reduce((sum, w, i) => i === ITEM_NAME_COL ? sum : sum + w, 0);

    // Give Item Name the remaining space
    let itemNameWidth = availableWidth - fixedColsWidth;
    let itemNameFontSize = BASE_FONT_SIZE;
    let globalFontSize = BASE_FONT_SIZE;

    const itemNameRequiredWidth = measureTextWidth(doc, maxTexts[ITEM_NAME_COL], BASE_FONT_SIZE) + CELL_PADDING;

    if (itemNameWidth < itemNameRequiredWidth) {
        // Try reducing item name font size
        for (let fs = BASE_FONT_SIZE - 0.5; fs >= MIN_FONT_SIZE; fs -= 0.5) {
            const needed = measureTextWidth(doc, maxTexts[ITEM_NAME_COL], fs) + CELL_PADDING;
            if (needed <= itemNameWidth) {
                itemNameFontSize = fs;
                break;
            }
            itemNameFontSize = fs;
        }

        // If still doesn't fit at min font, scale all columns down
        const stillNeeded = measureTextWidth(doc, maxTexts[ITEM_NAME_COL], itemNameFontSize) + CELL_PADDING;
        if (stillNeeded > itemNameWidth) {
            for (let fs = BASE_FONT_SIZE - 0.5; fs >= MIN_FONT_SIZE; fs -= 0.5) {
                const scaledFixed = clampedWidths.reduce((sum, w, i) => {
                    if (i === ITEM_NAME_COL) return sum;
                    const scaled = measureTextWidth(doc, maxTexts[i], fs) + CELL_PADDING;
                    return sum + Math.max(scaled, minWidths[i] * (fs / BASE_FONT_SIZE));
                }, 0);
                const remaining = availableWidth - scaledFixed;
                const itemNeeded = measureTextWidth(doc, maxTexts[ITEM_NAME_COL], fs) + CELL_PADDING;
                if (itemNeeded <= remaining) {
                    globalFontSize = fs;
                    itemNameFontSize = fs;
                    // Recalculate fixed widths at new font size
                    clampedWidths.forEach((_, i) => {
                        if (i !== ITEM_NAME_COL) {
                            const scaled = measureTextWidth(doc, maxTexts[i], fs) + CELL_PADDING;
                            clampedWidths[i] = Math.max(scaled, minWidths[i] * (fs / BASE_FONT_SIZE));
                        }
                    });
                    const newFixedTotal = clampedWidths.reduce((sum, w, i) => i === ITEM_NAME_COL ? sum : sum + w, 0);
                    itemNameWidth = availableWidth - newFixedTotal;
                    break;
                }
            }
        }
    }

    // Ensure item name width has a reasonable minimum
    itemNameWidth = Math.max(itemNameWidth, minWidths[ITEM_NAME_COL]);

    // Build final columns array
    const finalWidths = clampedWidths.map((w, i) => i === ITEM_NAME_COL ? itemNameWidth : w);

    const columns = COL_HEADERS.map((header, i) => ({
        header,
        width: finalWidths[i],
        align: [3, 4, 5, 6].includes(i) ? 'right' : (i === ITEM_NAME_COL ? 'left' : 'center')
    }));

    return { columns, fontSize: globalFontSize, itemNameFontSize };
};

/**
 * Generates a Party-wise Sales Order PDF.
 * Optimized for compactness, single-line rows, and aligned totals.
 */
export const generatePartyWisePDF = async (parsedData) => {
    console.log("generatePartyWisePDF started", parsedData);
    const { companyName, reportTitle, period, data } = parsedData;

    try {
        // Landscape A4
        // A4 Landscape size: 297mm x 210mm
        const doc = new jsPDF('l', 'mm', 'a4');
        console.log("jsPDF instance created");

        // Load Logo
        const logoUrl = '/logo.png';
        let logoData = null;
        try {
            const response = await fetch(logoUrl);
            const blob = await response.blob();
            logoData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error("Failed to load logo", e);
        }

        // --- Header Section ---
        if (logoData) {
            doc.addImage(logoData, 'PNG', 14, 10, 25, 25);
        }

        doc.setFontSize(18);
        const titleX = logoData ? 45 : 14;
        doc.text(companyName, titleX, 18);

        doc.setFontSize(14);
        doc.text(reportTitle, titleX, 25);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(period, titleX, 31);

        const genDate = new Date().toLocaleDateString('en-GB');
        doc.text(`Generated on: ${genDate}`, 280, 10, { align: 'right' });
        doc.setTextColor(0);

        let finalY = logoData ? 40 : 35;

        // --- Auto-fit Column Layout ---
        const availableWidth = 269; // A4 landscape minus margins (297 - 14 - 14)
        const allOrders = data.flatMap(group => group.orders);
        const { columns, fontSize: calcFontSize, itemNameFontSize } = calculateColumnLayout(doc, allOrders, availableWidth);

        // Map configuration to jspdf-autotable styles
        const colStyles = {};
        columns.forEach((col, i) => {
            colStyles[i] = {
                cellWidth: col.width,
                halign: col.align || 'center'
            };
            if (i === ITEM_NAME_COL) { colStyles[i].fontSize = itemNameFontSize; }
            if (i === 8) colStyles[i].textColor = [200, 50, 50]; // Overdue red
        });

        // Calculate X positions for manual drawing
        let currentX = 14;
        const colX = columns.map(col => {
            const x = currentX;
            currentX += col.width;
            return x;
        });

        let grandTotalOrdered = 0;
        let grandTotalBalance = 0;
        let grandTotalValue = 0;

        // --- Content Section ---
        data.forEach((partyGroup, index) => {
            const partyTotalOrdered = partyGroup.orders.reduce((sum, o) => sum + (o.orderedQty || 0), 0);
            const partyTotalBalance = partyGroup.orders.reduce((sum, o) => sum + (o.balanceQty || 0), 0);
            const partyTotalValue = partyGroup.orders.reduce((sum, o) => sum + (o.value || 0), 0);

            grandTotalOrdered += partyTotalOrdered;
            grandTotalBalance += partyTotalBalance;
            grandTotalValue += partyTotalValue;

            // Check space
            if (finalY > 185) {
                doc.addPage();
                finalY = 20;
            }

            // Party Header
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.setFillColor(240, 240, 240);
            doc.rect(14, finalY, 269, 7, 'F');
            doc.text(`${index + 1}. ${partyGroup.partyName}`, 16, finalY + 5);
            doc.setFont("helvetica", "normal");

            finalY += 7;

            // Generate Table
            autoTable(doc, {
                startY: finalY,
                head: [['Date', 'Order', 'Item Name', 'Ordered', 'Balance', 'Rate', 'Value', 'Due On', 'Overdue']],
                body: [
                    ...partyGroup.orders.map(order => [
                        order.date,
                        order.orderNo,
                        order.itemName,
                        formatWeight(order.orderedQty),
                        formatWeight(order.balanceQty),
                        formatCurrency(order.rate),
                        formatCurrency(order.value),
                        order.dueOn,
                        order.overdue
                    ]),
                    // Footer Row (Party Total)
                    [
                        { content: 'Total', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
                        { content: formatWeight(partyTotalOrdered), styles: { fontStyle: 'bold' } },
                        { content: formatWeight(partyTotalBalance), styles: { fontStyle: 'bold' } },
                        { content: '', styles: {} },
                        { content: formatCurrency(partyTotalValue), styles: { fontStyle: 'bold' } },
                        { content: '', colSpan: 2 }
                    ]
                ],
                theme: 'grid',
                styles: {
                    fontSize: calcFontSize,
                    cellPadding: 1.5,
                    overflow: 'ellipsize',
                    valign: 'middle',
                    halign: 'center',
                    lineWidth: 0.1,
                    lineColor: [200, 200, 200],
                    minCellHeight: 6
                },
                headStyles: {
                    fillColor: [245, 245, 245],
                    textColor: 0,
                    fontStyle: 'bold',
                    lineWidth: 0.1,
                    lineColor: [50, 50, 50],
                    minCellHeight: 8
                },
                columnStyles: colStyles,
                margin: { left: 14, right: 14 },
                rowPageBreak: 'avoid',
                didDrawPage: (data) => {
                    const str = 'Page ' + doc.internal.getNumberOfPages();
                    doc.setFontSize(8);
                    doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 10);
                }
            });

            finalY = doc.lastAutoTable.finalY + 4;
        });

        // --- Grand Total Section (Manual Drawing) ---
        // Height needed: 10mm
        if (finalY + 10 > 200) { // If less than 10mm left (margin is at 210)
            doc.addPage();
            finalY = 20;
        }

        // Draw Background
        doc.setFillColor(240, 255, 240); // Light Green
        doc.rect(14, finalY, 269, 10, 'F');

        // Draw Borders
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);
        doc.rect(14, finalY, 269, 10, 'S'); // Outer border

        // Set Text Styles
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);

        const yText = finalY + 6.5;

        // Label: "GRAND TOTAL" (Spanning Date, Order, Item)
        // Width = 20 + 22 + 98 = 140
        // Align Right in this block
        doc.text("GRAND TOTAL", colX[3] - 4, yText, { align: 'right' });

        // Values
        // Ordered (Col 3)
        doc.text(formatWeight(grandTotalOrdered), colX[3] + (columns[3].width / 2), yText, { align: 'center' });

        // Balance (Col 4)
        doc.text(formatWeight(grandTotalBalance), colX[4] + (columns[4].width / 2), yText, { align: 'center' });

        // Value (Col 6) - Note: Col 5 (Rate) is skipped
        doc.text(formatCurrency(grandTotalValue), colX[6] + (columns[6].width / 2), yText, { align: 'center' });

        // Vertical Lines for proper grid look (Optional, but good for "Visible Table")
        // Line after Item Name (Start of Ordered)
        doc.line(colX[3], finalY, colX[3], finalY + 10);
        // Line after Ordered (Start of Balance)
        doc.line(colX[4], finalY, colX[4], finalY + 10);
        // Line after Balance (Start of Rate)
        doc.line(colX[5], finalY, colX[5], finalY + 10);
        // Line after Rate (Start of Value)
        doc.line(colX[6], finalY, colX[6], finalY + 10);
        // Line after Value (Start of Due)
        doc.line(colX[7], finalY, colX[7], finalY + 10);

        const fileName = `${companyName.replace(/[^a-z0-9]/gi, '_')}_Sales_Orders.pdf`;
        doc.save(fileName);
        console.log("PDF Saved");
    } catch (error) {
        console.error("Error inside generatePartyWisePDF:", error);
        throw error;
    }
};
