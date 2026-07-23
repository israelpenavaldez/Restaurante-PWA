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

  const rows = groupedItems.map(group => `
    <tr>
      <td style="text-align:left;">${group.quantity}</td>
      <td style="text-align:left;">${group.name}${group.notes ? ` (${group.notes})` : ''}</td>
      <td style="text-align:right;">$${(group.price * group.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
<html>
<head>
  <meta charset="utf-8">
  <style>
    /* ===== CONFIGURACIÓN DE PÁGINA ===== */
    @page {
      margin: 5mm; /* Márgenes absolutos */
    }

    /* ===== ESTILOS BASE ===== */
    body {
      font-family: 'Courier New', monospace;
      margin: 0;
      padding: 0;
      width: 100%;
      box-sizing: border-box;
      /* Tamaño base: se ajusta automáticamente al ancho del papel */
      font-size: clamp(8pt, 2.2vw, 14pt); /* para vista previa en pantalla */
    }

    @media print {
      body {
        font-size: 14pt;
      }
    }

    /* ===== TODOS LOS TAMAÑOS (relativos al body) ===== */
    .header {
      text-align: center;
      font-weight: bold;
      font-size: 1.4em;
      margin-bottom: 0.2em;
    }
    .subheader {
      text-align: center;
      font-size: 1.2em;
      margin-bottom: 0.3em;
    }
    .info {
      font-size: 1em;
      margin-bottom: 0.3em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.6em;
      table-layout: fixed;
      word-wrap: break-word;
    }
    th, td {
      font-size: 1em;
      padding: 0.2em 0.15em;
      text-align: left;
    }
    th {
      border-bottom: 1px dashed #000;
      border-top: 1px dashed #000;
    }
    .total {
      text-align: right;
      font-weight: bold;
      margin-top: 0.6em;
      font-size: 1.2em;
      border-top: 1px dashed #000;
      padding-top: 0.3em;
    }
    .thanks {
      text-align: center;
      margin-top: 1.2em;
      font-size: 1.2em;
    }
    hr {
      border: none;
      border-top: 1px dashed #000;
      margin: 0.5em 0;
    }

    /* ===== VISTA PREVIA EN PANTALLA (opcional) ===== */
    @media screen {
      body {
        max-width: 58mm;
        margin: 0 auto;
        background: white;
        padding: 2mm;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
      }
    }
  </style>
</head>
<body>
  <div class="header">Cabaña "El Lago"</div>
  <hr>
  <div class="info">Mesa: ${order.tableNumber}</div>
  <div class="info">Cliente: ${order.clientName}</div>
  <div class="info">${fechaPago.toLocaleDateString()} - ${fechaPago.toLocaleTimeString()}</div>
  <hr>
  <table>
    <!-- Columnas con porcentajes que se adaptan al ancho disponible -->
    <colgroup>
      <col style="width: 15%;">
      <col style="width: 50%;">
      <col style="width: 35%;">
    </colgroup>
    <thead>
      <tr>
        <th style="text-align:left;">CANT</th>        
        <th style="text-align:left;">PROD</th>
        <th style="text-align:right;">IMP</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Total: $${total.toFixed(2)}</div>
  <hr>
  <div class="thanks">Gracias por su preferencia</div>
</body>
</html>
  `;
};