import { groupItemsForDisplay } from './helpers';

/**
 * Genera el contenido HTML del ticket para impresión.
 * El formato está optimizado para impresoras térmicas de 80 mm.
 *
 * @param {Object} order - Documento de la orden con sus lotes, productos, cliente y mesa.
 * @param {string} paymentMethod - Método de pago ('efectivo' o 'transferencia').
 * @returns {string} HTML completo del ticket listo para insertar en una ventana de impresión.
 */
export const generateTicketHTML = (order, paymentMethod) => {
  const allItems = (order.batches || []).flatMap(batch =>
    batch.items.filter(item => item.status !== 'cancelled')
  );
  const groupedItems = groupItemsForDisplay(allItems);
  const total = allItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const fechaPago = order.paidAt?.toDate() || new Date();
  const metodoTexto = paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia';

  const rows = groupedItems.map(group => `
    <tr>
      <td style="text-align:left;">${group.name}${group.notes ? ` (${group.notes})` : ''}</td>
      <td style="text-align:center;">${group.quantity}</td>
      <td style="text-align:right;">$${(group.price * group.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { size: 58mm auto; margin: 5mm; }
        body { font-family: 'Courier New', monospace; margin: 0; padding: 0; width: 100%; box-sizing: border-box; font-size: 10px;}
        .header { text-align: center; font-weight: bold; font-size: 1.5em; margin-bottom: 2px; }
        .subheader { text-align: center; font-size: 1em; margin-bottom: 4px; }
        .info { font-size: 1em; margin-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: fixed; word-wrap: break-word;}
        th, td { font-size: 0.8em; padding: 3px 2px; text-align: left; }
        th { border-bottom: 1px dashed #000; border-top: 1px dashed #000; }
        .total { text-align: right; font-weight: bold; margin-top: 6px; font-size: 1.3em; border-top: 1px dashed #000; padding-top: 4px; }
        .thanks { text-align: center; margin-top: 12px; font-size: 1.3em; }
        hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
      </style>
    </head>
    <body>
      <div class="header">Cabaña "El Lago"</div>
      <div class="subheader">Método de pago: ${metodoTexto}</div>
      <hr>
      <div class="info">Mesa: ${order.tableNumber} | Cliente: ${order.clientName}</div>
      <div class="info">${fechaPago.toLocaleDateString()} - ${fechaPago.toLocaleTimeString()}</div>
      <hr>
      <table>
        <colgroup><col style="width: 60%;"><col style="width: 15%;"><col style="width: 25%;"></colgroup>
        <thead><tr><th style="text-align:left;">Producto</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">Subtotal</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="total">Total: $${total.toFixed(2)}</div>
      <hr>
      <div class="thanks">Gracias por su preferencia</div>
    </body>
    </html>
  `;
};