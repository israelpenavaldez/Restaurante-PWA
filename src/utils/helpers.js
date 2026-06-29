/**
 * Utilidades generales del sistema.
 * Funciones auxiliares para formateo de tiempos, cálculos de totales,
 * validación de órdenes y agrupación de productos para su visualización.
 */

/**
 * Formatea el tiempo transcurrido desde una fecha de Firestore.
 * Devuelve una cadena legible como "2h 15min", "5 min" o "30s".
 *
 * @param {import('firebase/firestore').Timestamp} timestamp - Timestamp de Firestore.
 * @param {boolean} [showSeconds=false] - Si es true, incluye los segundos en el formato.
 * @returns {string} Tiempo transcurrido formateado, o cadena vacía si no hay timestamp.
 */
export const formatElapsedTime = (timestamp, showSeconds = false) => {
  if (!timestamp) return '';

  const diff = Math.floor((Date.now() - timestamp.toDate()) / 1000);
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  if (hours > 0) return `${hours}h ${minutes}min`;
  if (minutes > 0) return `${minutes} min` + (showSeconds ? ` ${seconds}s` : '');
  return `${seconds}s`;
};

/**
 * Calcula el total real de una orden, excluyendo los productos cancelados.
 * Recorre todos los lotes y suma el precio por cantidad de cada producto
 * cuyo estado no sea 'cancelled'.
 *
 * @param {Object} order - Documento de orden con su propiedad `batches`.
 * @returns {number} Total real de la orden.
 */
export const getRealTotal = (order) => {
  if (!order.batches) return 0;

  let total = 0;
  order.batches.forEach(batch => {
    batch.items.forEach(item => {
      if (item.status !== 'cancelled') {
        total += item.price * item.quantity;
      }
    });
  });

  return total;
};

/**
 * Verifica si una orden está completamente cancelada.
 * Una orden se considera completamente cancelada cuando todos sus lotes
 * contienen únicamente productos con estado 'cancelled'.
 *
 * @param {Object} order - Documento de orden con su propiedad `batches`.
 * @returns {boolean} `true` si la orden está completamente cancelada.
 */
export const isOrderCompletelyCancelled = (order) => {
  if (!order.batches || order.batches.length === 0) return false;

  return order.batches.every(batch =>
    batch.items.every(item => item.status === 'cancelled')
  );
};

/**
 * Obtiene la categoría a la que pertenece un producto según su nombre.
 * Busca en el arreglo de categorías del menú y devuelve el nombre
 * de la primera categoría que contenga un producto con ese nombre.
 *
 * @param {string} productName - Nombre del producto a buscar.
 * @param {Array} categories - Arreglo de categorías del menú, cada una con su propiedad `items`.
 * @returns {string} Nombre de la categoría encontrada, o 'Otros' si no se encuentra en ninguna.
 */
export const getProductCategory = (productName, categories) => {
  for (const cat of categories) {
    if (cat.items?.some(item => item.name === productName)) {
      return cat.name;
    }
  }
  return 'Otros';
};

/**
 * Agrupa productos idénticos para su visualización en la interfaz.
 *
 * Los productos se agrupan cuando comparten el mismo nombre, precio, categoría y estado,
 * siempre que no tengan notas de modificación. Los productos con notas se mantienen
 * siempre de forma individual.
 *
 * Cada grupo resultante contiene:
 * - `ids`: lista de IDs originales de los productos agrupados.
 * - `name`, `price`, `category`, `status`: datos comunes del grupo.
 * - `notes`: cadena vacía si es un grupo, o la nota individual si es un producto con notas.
 * - `quantity`: suma de las cantidades de todos los productos del grupo.
 * - `originalItems`: arreglo con los productos originales que forman el grupo.
 *
 * @param {Array} items - Arreglo de productos a agrupar.
 * @returns {Array} Arreglo de objetos de grupo, ordenados según su inserción.
 */
export const groupItemsForDisplay = (items) => {
  const map = new Map();

  items.forEach(item => {
    const hasNotes = item.notes && item.notes.trim() !== '';

    if (hasNotes) {
      // Los productos con notas nunca se agrupan
      map.set(`note_${item.id}`, {
        ids: [item.id],
        name: item.name,
        price: item.price,
        category: item.category,
        status: item.status,
        notes: item.notes,
        quantity: item.quantity,
        originalItems: [item],
      });
    } else {
      // Agrupar por nombre, precio, categoría y estado
      const key = `${item.name}_${item.price}_${item.category}_${item.status}`;

      if (!map.has(key)) {
        map.set(key, {
          ids: [item.id],
          name: item.name,
          price: item.price,
          category: item.category,
          status: item.status,
          notes: '',
          quantity: item.quantity,
          originalItems: [item],
        });
      } else {
        const group = map.get(key);
        group.ids.push(item.id);
        group.quantity += item.quantity;
        group.originalItems.push(item);
      }
    }
  });

  return Array.from(map.values());
};