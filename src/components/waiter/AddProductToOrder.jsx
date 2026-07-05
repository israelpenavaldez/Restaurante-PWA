import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getMenuCategories } from '../../services/firestoreService';
import { useNotification } from '../../context/NotificationContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useActionLock } from '../../hooks/useActionLock';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import { groupItemsForDisplay } from '../../utils/helpers';
import Card from '../ui/Card';
import Button from '../ui/Button';

/**
 * Vista para agregar un nuevo lote de productos a una orden existente.
 * Permite seleccionar una categoría del menú, agregar productos con cantidad
 * y notas, y confirmar la adición del nuevo lote.
 * Los productos inactivos se muestran atenuados y no se pueden agregar.
 */
const AddProductToOrder = () => {
  const { tableId, orderId } = useParams();
  const navigate = useNavigate();

  // ===== ESTADOS =====
  const [order, setOrder] = useState(null);
  const [realTableNumber, setRealTableNumber] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [tempItems, setTempItems] = useState([]);           // productos del lote temporal
  const [productQuantities, setProductQuantities] = useState({});
  const [productNotes, setProductNotes] = useState({});
  const isOnline = useOnlineStatus();

  const { checkWaiter } = usePermissions();
  const { withLock, isLocked } = useActionLock();
  const { notify, confirm } = useNotification();

  // ===== CARGA INICIAL =====

  /**
   * Obtiene el número real de la mesa desde Firestore.
   * Si no se encuentra la mesa, redirige al panel principal.
   */
  useEffect(() => {
    const fetchTableNumber = async () => {
      const tableDoc = await getDoc(doc(db, 'tables', tableId));
      if (tableDoc.exists()) {
        setRealTableNumber(tableDoc.data().number);
      } else {
        console.error('Mesa no encontrada');
        navigate('/dashboard');
      }
    };
    fetchTableNumber();
  }, [tableId, navigate]);

  /**
   * Carga los datos de la orden desde Firestore.
   * Si no se encuentra la orden, notifica el error y redirige a la vista de la mesa.
   */
  useEffect(() => {
    const fetchOrder = async () => {
      const docSnap = await getDoc(doc(db, 'orders', orderId));
      if (docSnap.exists()) {
        setOrder({ id: docSnap.id, ...docSnap.data() });
      } else {
        notify('Orden no encontrada', 'error');
        navigate(`/view/${tableId}`);
      }
    };
    fetchOrder();
  }, [orderId, tableId, navigate]);

  /**
   * Carga todas las categorías del menú desde Firestore,
   * incluyendo las inactivas (marcadas con etiqueta en el selector).
   */
  useEffect(() => {
    const fetchMenu = async () => {
      const cats = await getMenuCategories();
      cats.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(cats);
      if (cats.length > 0) setSelectedCategory(cats[0].id);
    };
    fetchMenu();
  }, []);

  // ===== PRODUCTOS DE LA CATEGORÍA SELECCIONADA =====

  const currentCategory = categories.find(c => c.id === selectedCategory);
  const products = currentCategory?.items || [];
  const sortedProducts = [...products].sort((a, b) => a.name.localeCompare(b.name));

  // ===== MANEJO DEL LOTE TEMPORAL =====

  /**
   * Agrega un producto al lote temporal.
   * Si el producto ya existe, incrementa la cantidad y actualiza las notas.
   * @param {Object} product - Producto seleccionado.
   */
  const addToTemp = (product) => {
    const quantity = productQuantities[product.id] || 1;
    const notes = productNotes[product.id] || '';
    if (quantity <= 0) return;

    const existingIndex = tempItems.findIndex(i => i.id === product.id);
    if (existingIndex !== -1) {
      // Producto ya en el lote: incrementar cantidad
      const updated = [...tempItems];
      updated[existingIndex].quantity += quantity;
      if (notes) updated[existingIndex].notes = notes;
      setTempItems(updated);
    } else {
      // Nuevo producto en el lote
      setTempItems([...tempItems, {
        id: Date.now(),
        name: product.name,
        price: product.price,
        quantity,
        notes,
        status: 'pending',
        category: currentCategory.name
      }]);
    }

    // Reiniciar campos de cantidad y notas
    setProductQuantities(prev => ({ ...prev, [product.id]: 1 }));
    setProductNotes(prev => ({ ...prev, [product.id]: '' }));
  };

  /**
   * Elimina uno o varios productos del lote temporal.
   * @param {number[]} itemIds - IDs de los productos a eliminar.
   */
  const removeTempItems = (itemIds) => {
    setTempItems(tempItems.filter(i => !itemIds.includes(i.id)));
  };

  // ===== ADICIÓN DEL LOTE A LA ORDEN =====

  /**
   * Agrega el lote temporal a la orden existente en Firestore.
   * Valida que haya al menos un producto en el lote.
   * Solicita confirmación antes de ejecutar la acción.
   */
  const handleSubmit = () => {
    withLock(async () => {
      try {
        checkWaiter();

        if (tempItems.length === 0) {
          notify('Agrega al menos un producto', 'warning');
          return;
        }

        const ok = await confirm('¿Agregar este lote a la orden?');
        if (!ok) return;

        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);
        const orderData = orderSnap.data();
        const currentBatches = orderData.batches || [];
        const newBatchId = currentBatches.length + 1;

        const newBatch = {
          batchId: newBatchId,
          timestamp: Timestamp.now(),
          status: 'pending',
          items: tempItems,
          deliveredAt: null
        };

        await updateDoc(orderRef, {
          batches: [...currentBatches, newBatch],
          status: 'pending',
          deliveredAt: null
        });

        notify('Productos agregados como nuevo lote', 'success');
        navigate(`/view/${tableId}`);
      } catch (err) {
        notify(err.message, 'error');
        navigate('/dashboard');
      }
    });
  };

  // ===== RENDERIZADO =====

  if (!order || categories.length === 0 || realTableNumber === null)
    return <div className="text-center mt-10 text-texto-claro">Cargando...</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 bg-fondo min-h-screen">
      {/* ===== BOTÓN VOLVER ===== */}
      <button onClick={() => navigate(`/view/${tableId}`)} className="text-acento hover:text-acento-hover font-medium mb-4 inline-flex items-center gap-1">
        ← Volver
      </button>

      <h2 className="text-3xl font-display font-bold text-texto mb-2">Agregar productos - Mesa: {realTableNumber}</h2>

      {/* ===== DATOS DE LA ORDEN ===== */}
      <Card className="mb-4 inline-block px-4 py-2">
        <strong className="text-texto">Cliente:</strong> {order.clientName}
      </Card>

      {/* ===== SELECTOR DE CATEGORÍA ===== */}
      <div className="mb-4">
        <label className="block font-medium text-texto mb-1">Categoría:</label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full p-2 border-b-2 border-borde bg-white/80 rounded-t-md text-texto focus:border-acento focus:outline-none transition"
        >
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* ===== CUADRÍCULA DE PRODUCTOS ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {sortedProducts.map(product => (
          <Card
            key={product.id}
            className={`flex flex-col items-center text-center ${product.active === false ? 'opacity-50' : ''}`}
          >
            {/* Etiqueta para productos no disponibles */}
            {product.active === false && (
              <span className="text-xs text-acento font-medium mb-1">No disponible</span>
            )}

            {/* Imagen del producto (variante → categoría → placeholder) */}
            <div className="flex justify-center mb-3">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="w-20 h-20 object-cover rounded-full border-2 border-borde" />
              ) : currentCategory?.imageUrl ? (
                <img src={currentCategory.imageUrl} alt={product.name} className="w-20 h-20 object-cover rounded-full border-2 border-borde" />
              ) : (
                <div className="w-20 h-20 bg-tarjeta-alt/30 rounded-full flex items-center justify-center text-3xl">🍽️</div>
              )}
            </div>

            <h4 className="font-display font-bold text-texto">{product.name}</h4>
            <h3 className="text-texto-claro text-sm mb-1">{product.description}</h3>
            <p className="text-texto-aviso font-bold text-lg mb-2">${product.price}</p>

            {/* Campos de cantidad, notas y botón Agregar */}
            <div className="mt-auto space-y-2 w-full">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                min="1"
                value={productQuantities[product.id] || 1}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val === '') return;
                  setProductQuantities(prev => ({ ...prev, [product.id]: parseInt(val) || 1 }));
                }}
                className="w-full p-1 border border-borde rounded-md text-center text-texto"
                disabled={product.active === false || isLocked}
              />
              <input
                type="text"
                placeholder="Modificaciones"
                value={productNotes[product.id] || ''}
                onChange={(e) => setProductNotes({ ...productNotes, [product.id]: e.target.value })}
                className="w-full p-1 border border-borde rounded-md text-center text-texto placeholder:text-texto-claro text-sm"
                disabled={product.active === false || isLocked}
              />
              <Button
                variant="primary"
                onClick={() => addToTemp(product)}
                className="w-full py-1"
                disabled={product.active === false || isLocked}
              >
                Agregar
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* ===== RESUMEN DEL LOTE ===== */}
      <Card className="mb-6">
        <h3 className="font-display font-bold text-xl text-texto mb-3">Productos a agregar (nuevo lote)</h3>
        {tempItems.length === 0 ? (
          <p className="text-texto-claro">No hay productos</p>
        ) : (
          <ul className="space-y-2">
            {groupItemsForDisplay(tempItems).map(group => (
              <li key={group.ids[0]} className="flex justify-between items-center border-b border-borde-claro pb-2">
                <span className="text-texto">
                  {group.name} x{group.quantity} - ${group.price * group.quantity}
                </span>
                {group.notes && <span className="text-texto-claro text-sm ml-2">({group.notes})</span>}
                <button onClick={() => removeTempItems(group.ids)} className="text-acento hover:text-acento-hover text-sm font-medium">
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ===== BOTÓN AGREGAR LOTE ===== */}
      <div className="flex justify-end">
        <Button variant="success" onClick={handleSubmit} disabled={isLocked || !isOnline} className="px-8 py-3 text-lg">
          {isLocked ? 'Agregando...' : 'Agregar lote'}
        </Button>
      </div>
    </div>
  );
};

export default AddProductToOrder;