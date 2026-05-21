import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getMenuCategories } from '../../services/firestoreService';
import { usePermissions } from '../../hooks/usePermissions';
import { useActionLock } from '../../hooks/useActionLock';
import Card from '../ui/Card';
import Button from '../ui/Button';

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

  const { checkWaiter } = usePermissions();
  const { withLock, isLocked } = useActionLock();

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
        checkWaiter();
        if (tempItems.length === 0) {
          alert('Agrega al menos un producto');
          return;
        }
        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);
        const orderData = orderSnap.data();
        const currentBatches = orderData.batches || [];
        const newBatchId = currentBatches.length + 1;
        const newBatch = { batchId: newBatchId, timestamp: Timestamp.now(), status: 'pending', items: tempItems, deliveredAt: null };
        await updateDoc(orderRef, { batches: [...currentBatches, newBatch], status: 'pending', deliveredAt: null });
        alert('Productos agregados como nuevo lote');
        navigate(`/view/${tableId}`);
      } catch (err) {
        alert(err.message);
        navigate('/dashboard');
      }
    });
  };

  if (!order || categories.length === 0 || realTableNumber === null) return <div className="text-center mt-10 text-tierra-clara">Cargando...</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 bg-crema min-h-screen">
      <button onClick={() => navigate(`/view/${tableId}`)} className="text-chile-guajillo hover:text-red-800 font-medium mb-4 inline-flex items-center gap-1">
        ← Volver
      </button>
      <h2 className="text-3xl font-display font-bold text-chocolate-oscuro mb-2">Agregar productos - Mesa {realTableNumber}</h2>
      <Card className="mb-4 inline-block px-4 py-2">
        <strong className="text-chocolate-oscuro">Cliente:</strong> {order.clientName}
      </Card>

      <div className="mb-4">
        <label className="block font-medium text-chocolate-oscuro mb-1">Categoría:</label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full p-2 border-b-2 border-barro-claro bg-white/80 rounded-t-md text-chocolate-oscuro focus:border-chile-guajillo focus:outline-none transition"
        >
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {sortedProducts.map(product => (
          <Card key={product.id} className="flex flex-col items-center text-center">
            <div className="flex justify-center mb-3">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="w-20 h-20 object-cover rounded-full border-2 border-barro-claro" />
              ) : currentCategory?.imageUrl ? (
                <img src={currentCategory.imageUrl} alt={product.name} className="w-20 h-20 object-cover rounded-full border-2 border-barro-claro" />
              ) : (
                <div className="w-20 h-20 bg-barro-claro/30 rounded-full flex items-center justify-center text-3xl">X</div>
              )}
            </div>
            <h4 className="font-display font-bold text-chocolate-oscuro">{product.name}</h4>
            <p className="text-maiz-dorado font-bold text-lg mb-2">${product.price}</p>
            <div className="mt-auto space-y-2 w-full">
              <input type="number" min="1" value={productQuantities[product.id] || 1}
                onChange={(e) => setProductQuantities({ ...productQuantities, [product.id]: parseInt(e.target.value) || 1 })}
                className="w-full p-1 border border-barro-claro rounded-md text-center text-chocolate-oscuro" />
              <input type="text" placeholder="Modificaciones"
                value={productNotes[product.id] || ''}
                onChange={(e) => setProductNotes({ ...productNotes, [product.id]: e.target.value })}
                className="w-full p-1 border border-barro-claro rounded-md text-center text-chocolate-oscuro placeholder:text-tierra-clara text-sm" />
              <Button variant="primary" onClick={() => addToTemp(product)} disabled={isLocked} className="w-full py-1">
                Agregar
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <h3 className="font-display font-bold text-xl text-chocolate-oscuro mb-3">Productos a agregar (nuevo lote)</h3>
        {tempItems.length === 0 ? (
          <p className="text-tierra-clara">No hay productos</p>
        ) : (
          <ul className="space-y-2">
            {tempItems.map(item => (
              <li key={item.id} className="flex justify-between items-center border-b border-barro-claro/30 pb-2">
                <span className="text-chocolate-oscuro">{item.name} x{item.quantity} - ${item.price * item.quantity}</span>
                {item.notes && <span className="text-tierra-clara text-sm ml-2">({item.notes})</span>}
                <button onClick={() => removeTempItem(item.id)} className="text-chile-guajillo hover:text-red-800 text-sm font-medium">Eliminar</button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex justify-end">
        <Button variant="success" onClick={handleSubmit} disabled={isLocked} className="px-8 py-3 text-lg">
          {isLocked ? 'Agregando...' : 'Agregar lote'}
        </Button>
      </div>
    </div>
  );
};

export default AddProductToOrder;