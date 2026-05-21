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