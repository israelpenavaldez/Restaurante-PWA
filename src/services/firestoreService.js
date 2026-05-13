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
  Timestamp,
  runTransaction
} from 'firebase/firestore';

// ---------- MESAS ----------
// Obtener todas las mesas (lectura única)
export const getTables = async () => {
  const snapshot = await getDocs(collection(db, 'tables'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Actualizar una mesa específica
export const updateTable = (tableId, data) => updateDoc(doc(db, 'tables', tableId), data);

// Suscripción en tiempo real a todas las mesas
export const subscribeToTables = (callback) => {
  return onSnapshot(collection(db, 'tables'), (snapshot) => {
    const tables = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(tables);
  });
};

// ---------- ÓRDENES ----------
// Crear una nueva orden
export const createOrder = (orderData) => addDoc(collection(db, 'orders'), orderData);

// Actualizar una orden existente
export const updateOrder = (orderId, data) => updateDoc(doc(db, 'orders', orderId), data);

// Obtener una orden por ID
export const getOrderById = async (orderId) => {
  const docSnap = await getDoc(doc(db, 'orders', orderId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

// Suscripción a órdenes de una mesa específica (para ViewTable)
export const subscribeToTableOrders = (tableNumber, callback) => {
  const q = query(collection(db, 'orders'), where('tableNumber', '==', tableNumber));
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(orders);
  });
};

// Suscripción a todas las órdenes (para chef y reportes)
export const subscribeToAllOrders = (callback) => {
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(orders);
  });
};

// Contador de numero de cliente
export const getNextClientNumber = async () => {
  const counterRef = doc(db, 'counters', 'clientCounter');
  let newNumber;
  await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    if (!counterDoc.exists()) {
      // Si no existe, lo creamos con valor 0 y luego incrementamos
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

// ---------- MENÚ ----------
// Obtener todas las categorías del menú (variables para mostrar productos)
export const getMenuCategories = async () => {
  const snapshot = await getDocs(collection(db, 'menuCategories'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Actualizar una categoría
export const updateMenuCategory = (categoryId, data) => updateDoc(doc(db, 'menuCategories', categoryId), data);

// Eliminar una categoría
export const deleteMenuCategory = (categoryId) => deleteDoc(doc(db, 'menuCategories', categoryId));

// ---------- CONFIGURACIÓN GLOBAL ----------
// Obtener la configuración (total de mesas, si el servicio está abierto)
export const getConfig = async () => {
  const docSnap = await getDoc(doc(db, 'config', 'settings'));
  return docSnap.exists() ? docSnap.data() : { totalTables: 8, isServiceOpen: true };
};

// Actualizar la configuración
export const updateConfig = (data) => updateDoc(doc(db, 'config', 'settings'), data);

// Obtener solo el estado del servicio (para ProtectedRoute)
export const getServiceStatus = async () => {
  const config = await getConfig();
  return config.isServiceOpen;
};

// Suscripción al estado del servicio (opcional, para actualizaciones instantáneas)
export const subscribeToServiceStatus = (callback) => {
  return onSnapshot(doc(db, 'config', 'settings'), (docSnap) => {
    const isOpen = docSnap.exists() ? docSnap.data().isServiceOpen : true;
    callback(isOpen);
  });
};