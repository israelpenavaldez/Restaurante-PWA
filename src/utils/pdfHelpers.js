import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { groupItemsForDisplay, getProductCategory } from './helpers';

/**
 * Genera y descarga un comprobante de pago detallado en PDF (tamaño carta).
 * Incluye encabezado del restaurante, datos de la mesa y cliente,
 * productos agrupados por categoría, productos cancelados, total y agradecimiento.
 *
 * @param {Object} order - Documento de la orden.
 * @param {Array} categories - Arreglo de categorías del menú.
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

  const groupedCancelled = groupItemsForDisplay(cancelledItems);

  // Agrupar por categoría
  const grouped = {};
  allItems.forEach(item => {
    const cat = getProductCategory(item.name, categories);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });
  Object.keys(grouped).forEach(cat => {
    grouped[cat] = groupItemsForDisplay(grouped[cat]);
  });

  const total = allItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // ===== CONFIGURACIÓN DEL DOCUMENTO =====
  const doc = new jsPDF({ format: 'letter' });

  // Tamaños de fuente
  const titleSize = 18;
  const subtitleSize = 14;
  const normalSize = 11;
  const tableFontSize = 10;

  // ===== ENCABEZADO =====
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(titleSize);
  doc.text("Cabaña \"El Lago\"", doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });

  // Tipo de cuenta
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(subtitleSize);
  const tipoCuenta = billType === 'prepay' ? 'Comprobante de pago anticipado' : 'Comprobante de pago';
  doc.text(tipoCuenta, doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });

  // Método de pago
  if (paymentMethod) {
    doc.setFontSize(normalSize);
    const metodoTexto = paymentMethod === 'efectivo' ? 'Método de pago: Efectivo' : 'Método de pago: Transferencia';
    doc.text(metodoTexto, doc.internal.pageSize.getWidth() / 2, 38, { align: 'center' });
  }

  // Línea separadora
  doc.setLineWidth(0.5);
  doc.line(14, 44, doc.internal.pageSize.getWidth() - 14, 44);

  // Datos de la mesa y cliente
  const fechaPago = order.paidAt?.toDate() || new Date();
  doc.setFontSize(normalSize);
  doc.text(`Mesa: ${order.tableNumber}`, 14, 52);
  doc.text(`Cliente: ${order.clientName}`, 14, 60);
  doc.text(`Fecha: ${fechaPago.toLocaleDateString()}`, 14, 68);
  doc.text(`Hora: ${fechaPago.toLocaleTimeString()}`, 100, 68);

  let y = 78;

  // ===== TABLAS POR CATEGORÍA =====
  Object.keys(grouped).forEach(cat => {
    // Verificar si hay espacio suficiente antes de la categoría
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(normalSize);
    doc.text(cat, 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Producto', 'Cant.', 'Precio', 'Total']],
      body: grouped[cat].map(group => [
        group.name + (group.notes ? ` (${group.notes})` : ''),
        group.quantity,
        `$${group.price}`,
        `$${(group.price * group.quantity).toFixed(2)}`
      ]),
      styles: { fontSize: tableFontSize, cellPadding: 3 },
      headStyles: { fontSize: tableFontSize, fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0] },
      margin: { left: 14, right: 14 },
      tableWidth: 'auto',
    });
    y = doc.lastAutoTable.finalY + 8;
  });

  // ===== CANCELADOS =====
  if (groupedCancelled.length > 0) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(normalSize);
    doc.setTextColor(180, 0, 0);
    doc.text('Productos cancelados', 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Producto', 'Cant.', 'Precio', 'Total']],
      body: groupedCancelled.map(group => [
        group.name,
        group.quantity,
        `$${group.price}`,
        `$${(group.price * group.quantity).toFixed(2)}`
      ]),
      styles: { fontSize: tableFontSize, textColor: [150, 150, 150], cellPadding: 3 },
      headStyles: { fontSize: tableFontSize, fontStyle: 'bold', fillColor: [250, 220, 220], textColor: [150, 0, 0] },
      margin: { left: 14, right: 14 },
      tableWidth: 'auto',
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ===== TOTAL =====
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(14, y, doc.internal.pageSize.getWidth() - 14, y);
  y += 8;

  // ===== TOTAL A PAGAR =====
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(subtitleSize);
  doc.setTextColor(0, 0, 0);
  doc.text(`Total a pagar: $${total.toFixed(2)}`, doc.internal.pageSize.getWidth() - 14, y, { align: 'right' });

  y += 12;

  // Línea final
  doc.line(14, y, doc.internal.pageSize.getWidth() - 14, y);
  y += 10;

  // ===== AGRADECIMIENTO =====
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