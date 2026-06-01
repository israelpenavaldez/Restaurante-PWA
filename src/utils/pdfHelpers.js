import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { groupItemsForDisplay } from './helpers';

/**
 * Genera y descarga un PDF con la cuenta de una orden, con formato de ticket.
 * @param {Object} order - Documento de orden
 * @param {Array} categories - Categorías del menú (no se usan)
 * @param {string} [billType='final'] - Tipo de cuenta (no se muestra)
 */
export const generateOrderPDF = (order, categories, billType = 'final') => {
  if (!order) return;

  const allItems = (order.batches || []).flatMap(batch =>
    batch.items.filter(item => item.status !== 'cancelled')
  );
  const cancelledItems = (order.batches || []).flatMap(batch =>
    batch.items.filter(item => item.status === 'cancelled')
  );

  const groupedItems = groupItemsForDisplay(allItems);
  const groupedCancelled = groupItemsForDisplay(cancelledItems);

  const total = allItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const doc = new jsPDF({ format: 'letter' });

  // Tamaños de fuente
  const titleSize = 28;
  const subtitleSize = 24;
  const normalSize = 22;
  const tableFontSize = 22;

  // ===== ENCABEZADO =====
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(titleSize);
  doc.text("Cabaña \"El Lago\"", doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });

  // Línea separadora
  doc.setLineWidth(0.5);
  doc.line(14, 30, doc.internal.pageSize.getWidth() - 14, 30);

  // Datos de la mesa y cliente
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(normalSize);
  const fecha = new Date();
  const datos = [
    `Mesa: ${order.tableNumber}`,
    `Cliente: ${order.clientName}`,
    `Fecha: ${fecha.toLocaleDateString()}`,
    `Hora: ${fecha.toLocaleTimeString()}`,
  ];
  let y = 40;
  datos.forEach(linea => {
    doc.text(linea, 14, y);
    y += 10;
  });

  // Línea separadora antes de la tabla
  y += 4;
  doc.line(14, y, doc.internal.pageSize.getWidth() - 14, y);
  y += 8;

  // ===== TABLA DE PRODUCTOS (sin columna Precio) =====
  autoTable(doc, {
    startY: y,
    head: [['Producto', 'Cant.', 'Total']],
    body: groupedItems.map(group => [
      group.name + (group.notes ? ` (${group.notes})` : ''),
      group.quantity,
      `$${(group.price * group.quantity).toFixed(2)}`
    ]),
    styles: {
      fontSize: tableFontSize,
      cellPadding: 4,
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'normal',
    },
    headStyles: {
      fontSize: tableFontSize,
      fontStyle: 'normal',
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
    },
    margin: { left: 14, right: 14 },
    tableWidth: 'auto',
  });
  y = doc.lastAutoTable.finalY + 10;

  // ===== CANCELADOS (si existen) =====
  if (groupedCancelled.length > 0) {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(normalSize);
    doc.setTextColor(180, 0, 0);
    doc.text('Cancelados', 14, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['Producto', 'Cant.', 'Total']],
      body: groupedCancelled.map(group => [
        group.name,
        group.quantity,
        `$${(group.price * group.quantity).toFixed(2)}`
      ]),
      styles: {
        fontSize: tableFontSize,
        textColor: [150, 150, 150],
        fillColor: [255, 255, 255],
        fontStyle: 'normal',
      },
      headStyles: {
        fontSize: tableFontSize,
        fontStyle: 'normal',
        textColor: [150, 150, 150],
        fillColor: [255, 255, 255],
      },
      margin: { left: 14, right: 14 },
      tableWidth: 'auto',
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Línea separadora antes del total
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(14, y, doc.internal.pageSize.getWidth() - 14, y);
  y += 10;

  // ===== TOTAL =====
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(subtitleSize);
  doc.setTextColor(0, 0, 0);
  doc.text(`Total a pagar: $${total.toFixed(2)}`, doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });

  y += 16;

  // Línea final
  doc.line(14, y, doc.internal.pageSize.getWidth() - 14, y);
  y += 12;

  // ===== AGRADECIMIENTO =====
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(normalSize);
  doc.text('Gracias por su preferencia', doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });

  // Guardar
  const fileName = `cuenta_mesa${order.tableNumber}_${order.clientName.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
};