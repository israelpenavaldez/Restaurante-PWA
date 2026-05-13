import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getMenuCategories } from '../../services/firestoreService';
import { usePermissions } from '../../hooks/usePermissions';
import { useActionLock } from '../../hooks/useActionLock';

const AddProductToOrder = () => {
  const { tableId, orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [realTableNumber, setRealTableNumber] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [tempItems, setTempItems] = useState([]);
  const [productQuantities, setProductQuantities] = useState({});
  const [productNotes, setProductNotes] = useState({});

  // Hooks de permisos y bloqueo
  const { checkWaiter } = usePermissions();
  const { withLock, isLocked } = useActionLock();

  // Obtener el número real de la mesa (igual que en OccupyTable)
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

  // Cargar la orden actual
  useEffect(() => {
    const fetchOrder = async () => {
      const docSnap = await getDoc(doc(db, 'orders', orderId));
      if (docSnap.exists()) {
        setOrder({ id: docSnap.id, ...docSnap.data() });
      } else {
        alert('Orden no encontrada');
        navigate(`/view/${tableId}`);
      }
    };
    fetchOrder();
  }, [orderId, tableId, navigate]);

  // Cargar las categorías del menú desde Firestore
  useEffect(() => {
    const fetchMenu = async () => {
      const cats = await getMenuCategories();
      cats.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(cats);
      if (cats.length > 0) setSelectedCategory(cats[0].id);
    };
    fetchMenu();
  }, []);

  const currentCategory = categories.find(c => c.id === selectedCategory);
  const products = currentCategory?.items || [];
  const sortedProducts = [...products].sort((a, b) => a.name.localeCompare(b.name));

  const addToTemp = (product) => {
    const quantity = productQuantities[product.id] || 1;
    const notes = productNotes[product.id] || '';
    if (quantity <= 0) return;
    const existingIndex = tempItems.findIndex(i => i.id === product.id);
    if (existingIndex !== -1) {
      const updated = [...tempItems];
      updated[existingIndex].quantity += quantity;
      if (notes) updated[existingIndex].notes = notes;
      setTempItems(updated);
    } else {
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
    setProductQuantities(prev => ({ ...prev, [product.id]: 1 }));
    setProductNotes(prev => ({ ...prev, [product.id]: '' }));
  };

  const removeTempItem = (id) => {
    setTempItems(tempItems.filter(i => i.id !== id));
  };

  const handleSubmit = () => {
    withLock(async () => {
      try {
        checkWaiter(); // verifica rol, habilitado y servicio abierto

        if (tempItems.length === 0) {
          alert('Agrega al menos un producto');
          return;
        }
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
          deliveredAt: null,
        };
        await updateDoc(orderRef, { batches: [...currentBatches, newBatch], status: 'pending', deliveredAt: null });
        alert('Productos agregados como nuevo lote');
        navigate(`/view/${tableId}`);
      } catch (err) {
        alert(err.message);
        navigate('/dashboard');
      }
    });
  };

  if (!order || categories.length === 0 || realTableNumber === null) return <div className="text-center mt-10">Cargando...</div>;

  return (
    <div className="max-w-6xl mx-auto p-4">
      <button onClick={() => navigate(`/view/${tableId}`)} className="text-blue-500 hover:underline mb-4">← Volver</button>
      <h2 className="text-2xl font-bold mb-2">Agregar productos - Mesa {realTableNumber}</h2>
      <div className="mb-4 p-2 bg-gray-100 rounded">
        <strong>Cliente:</strong> {order.clientName}
      </div>

      {/* Selector de categoría */}
      <div className="mb-4">
        <label className="block font-medium mb-1">Categoría:</label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        >
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* Productos de la categoría */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {sortedProducts.map(product => (
          <div key={product.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-center mb-2">
              {currentCategory.imageUrl ? (
                <img
                  src={currentCategory.imageUrl}
                  alt={product.name}
                  className="w-20 h-20 object-cover rounded-full"
                />
              ) : (
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-3xl">
                  🍽️
                </div>
              )}
            </div>
            <h4 className="font-semibold text-center">{product.name}</h4>
            <p className="text-center text-blue-600 font-bold">${product.price}</p>
            <div className="mt-2 space-y-2">
              <input
                type="number"
                min="1"
                value={productQuantities[product.id] || 1}
                onChange={(e) => setProductQuantities({ ...productQuantities, [product.id]: parseInt(e.target.value) || 1 })}
                className="w-full p-1 border border-gray-300 rounded"
              />
              <input
                type="text"
                placeholder="Modificaciones"
                value={productNotes[product.id] || ''}
                onChange={(e) => setProductNotes({ ...productNotes, [product.id]: e.target.value })}
                className="w-full p-1 border border-gray-300 rounded"
              />
              <button
                onClick={() => addToTemp(product)}
                disabled={isLocked}
                className="w-full bg-blue-500 text-white py-1 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Resumen temporal */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-lg mb-2">Productos a agregar (nuevo lote)</h3>
        {tempItems.length === 0 ? (
          <p className="text-gray-500">No hay productos</p>
        ) : (
          <ul className="space-y-2">
            {tempItems.map(item => (
              <li key={item.id} className="flex justify-between items-center border-b pb-1">
                <span>{item.name} x{item.quantity} - ${item.price * item.quantity}</span>
                {item.notes && <span className="text-gray-500 text-sm ml-2">({item.notes})</span>}
                <button onClick={() => removeTempItem(item.id)} className="text-red-500 hover:text-red-700">Eliminar</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={isLocked}
          className="bg-green-600 text-white px-6 py-3 rounded-lg text-lg font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          {isLocked ? 'Agregando...' : 'Agregar lote'}
        </button>
      </div>
    </div>
  );
};

export default AddProductToOrder;