import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { groupItemsForDisplay } from './helpers';

/**
 * Genera y descarga un comprobante de pago en formato PDF.
 * Crea un ticket tamaño carta con los datos de la orden, método de pago,
 * productos agrupados, total y un mensaje de agradecimiento.
 *
 * @param {Object} order - Documento de la orden con sus lotes, productos, cliente y mesa.
 * @param {Array} categories - Arreglo de categorías del menú (actualmente no se usan en el PDF).
 * @param {string} [billType='final'] - Tipo de cuenta ('prepay' o 'final').
 * @param {string} [paymentMethod=''] - Método de pago ('efectivo' o 'transferencia').
 */
export const generateOrderPDF = (order, categories, billType = 'final', paymentMethod = '') => {
  if (!order) return;

  // ===== RECOLECCIÓN DE PRODUCTOS =====
  const allItems = (order.batches || []).flatMap(batch =>
    batch.items.filter(item => item.status !== 'cancelled')
  );
  const cancelledItems = (order.batches || []).flatMap(batch =>
    batch.items.filter(item => item.status === 'cancelled')
  );

  const groupedItems = groupItemsForDisplay(allItems);
  const groupedCancelled = groupItemsForDisplay(cancelledItems);

  const total = allItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // ===== CONFIGURACIÓN DEL DOCUMENTO =====
  const doc = new jsPDF({ format: 'letter' });

  // Tamaños de fuente grandes para legibilidad en impresión térmica
  const titleSize = 28;
  const subtitleSize = 24;
  const normalSize = 22;
  const tableFontSize = 22;

  // ===== ENCABEZADO =====
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(titleSize);
  doc.text("Cabaña \"El Lago\"", doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });

  // Método de pago (si se proporcionó)
  if (paymentMethod) {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(normalSize);
    const metodoTexto = paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia';
    doc.text(`Método de pago: ${metodoTexto}`, doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });
  }

  // Línea separadora
  doc.setLineWidth(0.5);
  doc.line(14, 36, doc.internal.pageSize.getWidth() - 14, 36);

  // Fecha y hora del pago (con respaldo a la fecha actual si no existe)
  const fechaPago = order.paidAt?.toDate() || new Date();

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(normalSize);
  const datos = [
    `Mesa: ${order.tableNumber}`,
    `Cliente: ${order.clientName}`,
    `Fecha: ${fechaPago.toLocaleDateString()}`,
    `Hora: ${fechaPago.toLocaleTimeString()}`,
  ];
  let y = 46;
  datos.forEach(linea => {
    doc.text(linea, 14, y);
    y += 10;
  });

  // Línea separadora antes de la tabla
  y += 4;
  doc.line(14, y, doc.internal.pageSize.getWidth() - 14, y);
  y += 8;

  // ===== TABLA DE PRODUCTOS (sin columna de precio unitario) =====
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

  // ===== PRODUCTOS CANCELADOS (si existen) =====
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

  // ===== TOTAL A PAGAR =====
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(subtitleSize);
  doc.setTextColor(0, 0, 0);
  doc.text(`Total a pagar: $${total.toFixed(2)}`, doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });

  y += 16;
  doc.line(14, y, doc.internal.pageSize.getWidth() - 14, y);
  y += 12;

  // ===== MENSAJE DE AGRADECIMIENTO =====
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(normalSize);
  doc.text('Gracias por su preferencia', doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });

  // ===== NOMBRE DEL ARCHIVO =====
  const dia = String(fechaPago.getDate()).padStart(2, '0');
  const mes = String(fechaPago.getMonth() + 1).padStart(2, '0');
  const año = String(fechaPago.getFullYear()).slice(-2);
  const fechaStr = `${dia}-${mes}-${año}`;

  const horaStr = String(fechaPago.getHours()).padStart(2, '0');
  const minStr = String(fechaPago.getMinutes()).padStart(2, '0');
  const horaCompleta = `${horaStr}-${minStr}`;

  const fileName = `Comprobante_Mesa-${order.tableNumber}_${order.clientName}_${fechaStr}_${horaCompleta}.pdf`;
  doc.save(fileName);
};