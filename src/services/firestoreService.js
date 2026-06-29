import { db } from '../firebase/config';
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  runTransaction
} from 'firebase/firestore';

// ===== MESAS =====

/**
 * Obtiene todas las mesas registradas en una sola lectura.
 * @returns {Promise<Array>} Lista de mesas con sus datos e ID.
 */
export const getTables = async () => {
  const snapshot = await getDocs(collection(db, 'tables'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Actualiza los datos de una mesa específica.
 * @param {string} tableId - ID del documento de la mesa.
 * @param {Object} data - Campos a actualizar (ej. status, occupiedSince, active).
 * @returns {Promise<void>}
 */
export const updateTable = (tableId, data) => updateDoc(doc(db, 'tables', tableId), data);

/**
 * Suscripción en tiempo real a todas las mesas.
 * El callback se ejecuta cada vez que hay un cambio en la colección.
 * @param {Function} callback - Función que recibe la lista actualizada de mesas.
 * @returns {Function} Función para cancelar la suscripción.
 */
export const subscribeToTables = (callback) => {
  return onSnapshot(collection(db, 'tables'), (snapshot) => {
    const tables = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(tables);
  });
};

// ===== ÓRDENES =====

/**
 * Crea una nueva orden en Firestore.
 * @param {Object} orderData - Datos completos de la orden (tableId, clientName, batches, etc.).
 * @returns {Promise<Object>} Referencia al documento creado.
 */
export const createOrder = (orderData) => addDoc(collection(db, 'orders'), orderData);

/**
 * Actualiza campos específicos de una orden existente.
 * @param {string} orderId - ID del documento de la orden.
 * @param {Object} data - Campos a actualizar (ej. status, batches, deliveredAt).
 * @returns {Promise<void>}
 */
export const updateOrder = (orderId, data) => updateDoc(doc(db, 'orders', orderId), data);

/**
 * Obtiene una orden por su ID (lectura única).
 * @param {string} orderId - ID del documento de la orden.
 * @returns {Promise<Object|null>} Datos de la orden con su ID, o null si no existe.
 */
export const getOrderById = async (orderId) => {
  const docSnap = await getDoc(doc(db, 'orders', orderId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

/**
 * Suscripción en tiempo real a las órdenes de una mesa específica.
 * Filtra por el número de mesa (campo `tableNumber`).
 * @param {string} tableNumber - Número de mesa (ej. "5", "Terraza").
 * @param {Function} callback - Función que recibe la lista actualizada de órdenes.
 * @returns {Function} Función para cancelar la suscripción.
 */
export const subscribeToTableOrders = (tableNumber, callback) => {
  const q = query(collection(db, 'orders'), where('tableNumber', '==', tableNumber));
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(orders);
  });
};

/**
 * Suscripción en tiempo real a todas las órdenes, ordenadas por fecha de creación descendente.
 * Utilizada por el panel de cocina y los reportes.
 * @param {Function} callback - Función que recibe la lista actualizada de todas las órdenes.
 * @returns {Function} Función para cancelar la suscripción.
 */
export const subscribeToAllOrders = (callback) => {
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(orders);
  });
};

/**
 * Obtiene el siguiente número de cliente de forma atómica usando una transacción.
 * Utiliza un contador en la colección `counters` para evitar duplicados.
 * @returns {Promise<number>} Siguiente número de cliente.
 */
export const getNextClientNumber = async () => {
  const counterRef = doc(db, 'counters', 'clientCounter');
  let newNumber;
  await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    if (!counterDoc.exists()) {
      // Si no existe, se crea con valor inicial 0 y se devuelve 1
      transaction.set(counterRef, { lastNumber: 0 });
      newNumber = 1;
    } else {
      const current = counterDoc.data().lastNumber || 0;
      newNumber = current + 1;
      transaction.update(counterRef, { lastNumber: newNumber });
    }
  });
  return newNumber;
};

// ===== MENÚ =====

/**
 * Obtiene todas las categorías del menú (con sus variantes).
 * @returns {Promise<Array>} Lista de categorías con sus datos e ID.
 */
export const getMenuCategories = async () => {
  const snapshot = await getDocs(collection(db, 'menuCategories'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Actualiza una categoría del menú.
 * @param {string} categoryId - ID del documento de la categoría.
 * @param {Object} data - Campos a actualizar (ej. name, items, active).
 * @returns {Promise<void>}
 */
export const updateMenuCategory = (categoryId, data) => updateDoc(doc(db, 'menuCategories', categoryId), data);

/**
 * Elimina permanentemente una categoría del menú.
 * @param {string} categoryId - ID del documento de la categoría a eliminar.
 * @returns {Promise<void>}
 */
export const deleteMenuCategory = (categoryId) => deleteDoc(doc(db, 'menuCategories', categoryId));

// ===== CONFIGURACIÓN GLOBAL =====

/**
 * Obtiene la configuración global del sistema (estado del servicio, total de mesas, etc.).
 * Si el documento no existe, devuelve valores por defecto.
 * @returns {Promise<Object>} Datos de configuración.
 */
export const getConfig = async () => {
  const docSnap = await getDoc(doc(db, 'config', 'settings'));
  return docSnap.exists() ? docSnap.data() : { totalTables: 8, isServiceOpen: true };
};

/**
 * Actualiza la configuración global del sistema.
 * @param {Object} data - Campos a actualizar (ej. isServiceOpen, totalTables).
 * @returns {Promise<void>}
 */
export const updateConfig = (data) => updateDoc(doc(db, 'config', 'settings'), data);

/**
 * Obtiene únicamente el estado actual del servicio (abierto/cerrado).
 * @returns {Promise<boolean>} `true` si el servicio está abierto, `false` en caso contrario.
 */
export const getServiceStatus = async () => {
  const config = await getConfig();
  return config.isServiceOpen;
};

/**
 * Suscripción en tiempo real al estado del servicio.
 * El callback se ejecuta cada vez que cambia el documento de configuración.
 * @param {Function} callback - Función que recibe el estado actualizado (booleano).
 * @returns {Function} Función para cancelar la suscripción.
 */
export const subscribeToServiceStatus = (callback) => {
  return onSnapshot(doc(db, 'config', 'settings'), (docSnap) => {
    const isOpen = docSnap.exists() ? docSnap.data().isServiceOpen : true;
    callback(isOpen);
  });
};