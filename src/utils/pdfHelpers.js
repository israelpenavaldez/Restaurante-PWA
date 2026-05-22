import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getProductCategory } from './helpers';

/**
 * Genera y descarga un PDF con la cuenta de una orden.
 * @param {Object} order - Documento de orden (con batches, items, clientName, tableNumber, etc.)
 * @param {Array} categories - Arreglo de categorías del menú (para agrupar productos)
 * @param {string} [billType='final'] - 'final' o 'prepay' (para el título)
 */
export const generateOrderPDF = (order, categories, billType = 'final') => {
  if (!order) return;

  const allItems = (order.batches || []).flatMap(batch =>
    batch.items.filter(item => item.status !== 'cancelled')
  );
  const cancelledItems = (order.batches || []).flatMap(batch =>
    batch.items.filter(item => item.status === 'cancelled')
  );

  // Agrupar por categoría
  const grouped = {};
  allItems.forEach(item => {
    const cat = getProductCategory(item.name, categories);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  const total = allItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const doc = new jsPDF();

  // Título
  doc.setFontSize(18);
  doc.text(
    billType === 'prepay' ? 'Pago anticipado' : 'Cuenta final',
    14,
    15
  );

  // Datos de la mesa y cliente
  doc.setFontSize(11);
  doc.text(`Mesa: ${order.tableNumber}`, 14, 25);
  doc.text(`Cliente: ${order.clientName}`, 14, 32);
  doc.text(`Fecha: ${new Date().toLocaleString()}`, 14, 39);

  let y = 48;

  // Tablas por categoría
  Object.keys(grouped).forEach(cat => {
    doc.setFontSize(12);
    doc.text(cat, 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Producto', 'Cant.', 'Precio', 'Total']],
      body: grouped[cat].map(item => [
        item.name + (item.notes ? ` (${item.notes})` : ''),
        item.quantity,
        `$${item.price}`,
        `$${(item.price * item.quantity).toFixed(2)}`
      ]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [200, 200, 200] },
    });
    y = doc.lastAutoTable.finalY + 6;
  });

  // Cancelados
  if (cancelledItems.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(200, 0, 0);
    doc.text('Cancelados', 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Producto', 'Cant.', 'Precio', 'Total']],
      body: cancelledItems.map(item => [
        item.name,
        item.quantity,
        `$${item.price}`,
        `$${(item.price * item.quantity).toFixed(2)}`
      ]),
      styles: { fontSize: 10, textColor: [150, 150, 150] },
      headStyles: { fillColor: [230, 150, 150] },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // Total
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`Total a pagar: $${total.toFixed(2)}`, 14, y);

  // Guardar
  const fileName = `cuenta_mesa${order.tableNumber}_${order.clientName.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
};