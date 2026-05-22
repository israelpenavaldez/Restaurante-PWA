/**
 * Formatea el tiempo transcurrido desde un Timestamp de Firestore
 * @param {import('firebase/firestore').Timestamp} timestamp 
 * @param {boolean} showSeconds - si es true muestra segundos
 * @returns {string}
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
 * Calcula el total real de una orden excluyendo cancelados
 * @param {Object} order - documento de orden
 * @returns {number}
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
 * Verifica si una orden está completamente cancelada
 * @param {Object} order - documento de orden
 * @returns {boolean}
 */
export const isOrderCompletelyCancelled = (order) => {
  if (!order.batches || order.batches.length === 0) return false;
  return order.batches.every(batch =>
    batch.items.every(item => item.status === 'cancelled')
  );
};

/**
 * Obtiene la categoría de un producto por su nombre
 * @param {string} productName 
 * @param {Array} categories - arreglo de categorías con items
 * @returns {string}
 */
export const getProductCategory = (productName, categories) => {
  for (const cat of categories) {
    if (cat.items?.some(item => item.name === productName)) return cat.name;
  }
  return 'Otros';
};
/**
 * Agrupa ítems idénticos (mismo nombre, precio, categoría, estado) que no tengan modificaciones (notes).
 * Los ítems con notas se mantienen individuales.
 */
export const groupItemsForDisplay = (items) => {
  const map = new Map();
  items.forEach(item => {
    const hasNotes = item.notes && item.notes.trim() !== '';
    if (hasNotes) {
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