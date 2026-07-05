import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { createOrder, getMenuCategories } from '../../services/firestoreService';
import { useNotification } from '../../context/NotificationContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useActionLock } from '../../hooks/useActionLock';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import { groupItemsForDisplay } from '../../utils/helpers';
import Card from '../ui/Card';
import Button from '../ui/Button';

/**
 * Vista para agregar una nueva orden (cliente adicional) a una mesa ocupada.
 * Permite ingresar el nombre del cliente, seleccionar una categoría del menú,
 * agregar productos con cantidad y notas, y confirmar la creación de la orden.
 * Los productos inactivos se muestran atenuados y no se pueden agregar.
 */
const AddClientToTable = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();

  // ===== ESTADOS =====
  const [clientName, setClientName] = useState('');
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

  // ===== CREACIÓN DE LA ORDEN =====

  /**
   * Envía el lote temporal como una nueva orden a Firestore.
   * Valida que haya nombre de cliente, productos y número de mesa.
   * Solicita confirmación antes de crear la orden.
   */
  const handleSubmit = () => {
    withLock(async () => {
      try {
        checkWaiter();

        if (realTableNumber === null) {
          notify('Error: número de mesa no disponible', 'error');
          return;
        }
        if (!clientName.trim()) {
          notify('Debes ingresar el nombre del cliente', 'warning');
          return;
        }
        if (tempItems.length === 0) {
          notify('Agrega al menos un producto', 'warning');
          return;
        }

        const ok = await confirm('¿Crear la nueva orden?');
        if (!ok) return;

        const orderData = {
          tableId: tableId,
          tableNumber: realTableNumber,
          clientName: clientName.trim(),
          batches: [{ batchId: 1, timestamp: Timestamp.now(), status: 'pending', items: tempItems, deliveredAt: null }],
          status: 'pending',
          prepaid: false,
          createdAt: Timestamp.now(),
          deliveredAt: null,
          completedAt: null,
          total: tempItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
        };

        await createOrder(orderData);
        notify('Nueva orden creada', 'success');
        navigate(`/view/${tableId}`);
      } catch (err) {
        notify(err.message, 'error');
        navigate('/dashboard');
      }
    });
  };

  // ===== RENDERIZADO =====

  if (categories.length === 0 || realTableNumber === null)
    return <div className="text-center mt-10 text-texto-claro">Cargando menú...</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 bg-fondo min-h-screen">
      {/* ===== BOTÓN VOLVER ===== */}
      <button onClick={() => navigate(`/view/${tableId}`)} className="text-acento hover:text-acento-hover font-medium mb-4 inline-flex items-center gap-1">
        ← Volver
      </button>

      <h2 className="text-3xl font-display font-bold text-texto mb-4">Agregar nueva orden - Mesa: {realTableNumber}</h2>

      {/* ===== NOMBRE DEL CLIENTE ===== */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Nombre del cliente *"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          className="w-full p-2 border-b-2 border-borde bg-white/80 rounded-t-md text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none transition"
        />
      </div>

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

      {/* ===== RESUMEN DE LA ORDEN ===== */}
      <Card className="mb-6">
        <h3 className="font-display font-bold text-xl text-texto mb-3">Resumen de la orden</h3>
        {tempItems.length === 0 ? (
          <p className="text-texto-claro">No hay productos agregados</p>
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

      {/* ===== BOTÓN CREAR ORDEN ===== */}
      <div className="flex justify-end">
        <Button variant="success" onClick={handleSubmit} disabled={isLocked || !isOnline} className="px-8 py-3 text-lg">
          {isLocked ? 'Creando...' : 'Crear orden'}
        </Button>
      </div>
    </div>
  );
};

export default AddClientToTable;