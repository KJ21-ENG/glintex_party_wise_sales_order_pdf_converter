
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

        // --- Explicit Column Configurations ---
        // Total width = 269mm
        const columns = [
            { header: 'Date', width: 22 },      // 0: X=14
            { header: 'Order', width: 26 },     // 1: X=36
            { header: 'Item Name', width: 80 }, // 2: X=62
            { header: 'Ordered', width: 26, align: 'right' },  // 3: X=142
            { header: 'Balance', width: 26, align: 'right' },  // 4: X=168
            { header: 'Rate', width: 18, align: 'right' },     // 5: X=194
            { header: 'Value', width: 24, align: 'right' },    // 6: X=212
            { header: 'Due On', width: 22 },    // 7: X=236
            { header: 'Overdue', width: 25 }    // 8: X=258 -> Ends at 283 (Wait, 14+269=283)
        ];

        // Map configuration to jspdf-autotable styles
        const colStyles = {};
        columns.forEach((col, i) => {
            colStyles[i] = {
                cellWidth: col.width,
                halign: col.align || 'center'
            };
            if (i === 2) colStyles[i].halign = 'left'; // Item Name left
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
                    fontSize: 8,
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
        // Width = 22 + 26 + 80 = 128
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
