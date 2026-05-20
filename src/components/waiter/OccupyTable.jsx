import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createOrder, updateTable, getMenuCategories } from '../../services/firestoreService';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { usePermissions } from '../../hooks/usePermissions';
import { useActionLock } from '../../hooks/useActionLock';

const OccupyTable = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { userData } = useAuth();
  const { checkWaiter } = usePermissions();
  const { withLock, isLocked } = useActionLock();

  const [clients, setClients] = useState([]);
  const [activeClientId, setActiveClientId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [productQuantities, setProductQuantities] = useState({});
  const [productNotes, setProductNotes] = useState({});
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [realTableNumber, setRealTableNumber] = useState(null);

  // 1. Obtener el número real de la mesa desde Firestore
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

  // 2. Cargar menú desde Firestore
  useEffect(() => {
    const fetchMenu = async () => {
      const cats = await getMenuCategories();
      cats.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(cats);
      if (cats.length > 0) setSelectedCategory(cats[0].id);
      setLoadingMenu(false);
    };
    fetchMenu();
  }, []);

  // 3. Inicializar primer cliente
  useEffect(() => {
    if (clients.length === 0 && !loadingMenu && realTableNumber !== null) {
      const now = new Date();
      const formattedDate = now.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const formattedTime = now.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).replace(':', '-');
      const generatedName = `M${realTableNumber}-${formattedDate}-${formattedTime}`;
      const firstClient = { id: Date.now(), name: generatedName, orders: [] };
      setClients([firstClient]);
      setActiveClientId(firstClient.id);
    }
  }, [loadingMenu, realTableNumber, clients.length]);

  // 4. Agregar cliente adicional
  const handleAddClient = () => {
    const newName = prompt('Ingrese el nombre del nuevo cliente (obligatorio):');
    if (!newName || newName.trim() === '') {
      alert('El nombre es obligatorio para órdenes adicionales');
      return;
    }
    const newClient = { id: Date.now(), name: newName.trim(), orders: [] };
    setClients(prev => [...prev, newClient]);
    setActiveClientId(newClient.id);
  };

  const handleRemoveClient = (clientId) => {
    if (clients.length === 1) {
      alert('No se puede eliminar el último cliente.');
      return;
    }
    setClients(prev => prev.filter(c => c.id !== clientId));
    if (activeClientId === clientId) {
      setActiveClientId(clients[0].id);
    }
  };

  const updateClientName = (clientId, name) => {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, name } : c));
  };

  const addProductToClient = (clientId, product, quantity, notes) => {
    if (quantity <= 0) return;
    const newOrder = {
      id: Date.now(),
      name: product.name,
      price: product.price,
      quantity,
      notes,
      status: 'pending',
      category: currentCategory?.name || 'General'
    };
    setClients(prev => prev.map(c =>
      c.id === clientId ? { ...c, orders: [...c.orders, newOrder] } : c
    ));
    setProductQuantities(prev => ({ ...prev, [product.id]: 1 }));
    setProductNotes(prev => ({ ...prev, [product.id]: '' }));
  };

  const removeOrder = (clientId, orderId) => {
    setClients(prev => prev.map(c =>
      c.id === clientId ? { ...c, orders: c.orders.filter(o => o.id !== orderId) } : c
    ));
  };

  // 5. Enviar órdenes a cocina
  const handleSubmit = () => {
    withLock(async () => {
      try {
        checkWaiter();

        if (realTableNumber === null) {
          alert('Error: número de mesa no disponible');
          return;
        }
        // Validar que cada cliente tenga productos y (si es adicional) nombre
        for (const client of clients) {
          if (client.orders.length === 0) {
            alert(`El cliente ${client.name || 'desconocido'} no tiene productos`);
            return;
          }
          if (clients.length > 1 && (!client.name || client.name.trim() === '')) {
            alert('Todos los clientes adicionales deben tener nombre');
            return;
          }
        }

        for (const client of clients) {
          // Determinar nombre final del cliente
          let finalClientName;
          if (client.name && client.name.trim() !== '') {
            finalClientName = client.name.trim();
          } else {
            finalClientName = `M${realTableNumber}-${new Date().toLocaleString().replace(/[\/:,]/g, '-')}`;
          }
          const orderData = {
            tableId: tableId,
            tableNumber: realTableNumber,
            clientName: finalClientName,
            batches: [
              {
                batchId: 1,
                timestamp: Timestamp.now(),
                status: 'pending',
                items: client.orders,
                deliveredAt: null
              }
            ],
            status: 'pending',
            prepaid: false,
            createdAt: Timestamp.now(),
            deliveredAt: null,
            completedAt: null,
            total: client.orders.reduce((sum, item) => sum + item.price * item.quantity, 0)
          };
          await createOrder(orderData);
        }
        // Marcar la mesa como ocupada
        await updateTable(tableId, { status: 'occupied', occupiedSince: Timestamp.now() });
        alert('Órdenes enviadas a cocina');
        navigate('/dashboard');
      } catch (permError) {
        alert(permError.message);
        navigate('/dashboard');
      }
    }, (error) => alert(error.message));
  };

  const activeClient = clients.find(c => c.id === activeClientId);
  const currentCategory = categories.find(cat => cat.id === selectedCategory);
  const products = currentCategory?.items || [];
  const sortedProducts = [...products].sort((a, b) => a.name.localeCompare(b.name));

  if (loadingMenu || clients.length === 0 || realTableNumber === null) {
    return <div className="text-center mt-10">Cargando...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <button onClick={() => navigate('/dashboard')} className="text-blue-500 hover:underline mb-4">← Volver</button>
      <h2 className="text-2xl font-bold mb-6">Ocupar Mesa {realTableNumber}</h2>

      <div className="flex flex-wrap gap-2 mb-6">
        {clients.map(client => (
          <div key={client.id} className="relative">
            <button
              onClick={() => setActiveClientId(client.id)}
              className={`px-4 py-2 rounded-full ${activeClientId === client.id ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              {client.name || 'Cliente sin nombre'}
            </button>
            <button
              onClick={() => handleRemoveClient(client.id)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
              title="Eliminar cliente"
            >
              ×
            </button>
          </div>
        ))}
        <button onClick={handleAddClient} className="bg-green-500 text-white px-4 py-2 rounded-full hover:bg-green-600">
          + Nueva orden
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Nombre del cliente (opcional solo para el primer cliente)"
          value={activeClient?.name || ''}
          onChange={(e) => updateClientName(activeClient.id, e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg"
        />
        {clients.length > 1 && (
          <p className="text-xs text-red-500 mt-1">* Los clientes adicionales deben tener nombre</p>
        )}
      </div>

      <div className="mb-4">
        <label className="block font-medium mb-1">Categoría:</label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg"
        >
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {sortedProducts.map(product => (
          <div key={product.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-center mb-2">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-20 h-20 object-cover rounded-full"
                />
              ) : currentCategory?.imageUrl ? (
                <img
                  src={currentCategory.imageUrl}
                  alt={product.name}
                  className="w-20 h-20 object-cover rounded-full"
                />
              ) : (
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-3xl">X</div>
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
                onClick={() => addProductToClient(activeClient.id, product, productQuantities[product.id] || 1, productNotes[product.id] || '')}
                className="w-full bg-blue-500 text-white py-1 rounded hover:bg-blue-600"
              >
                Agregar
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-lg mb-2">Resumen de {activeClient?.name || 'cliente'}</h3>
        {activeClient?.orders.length === 0 ? (
          <p>No hay productos agregados</p>
        ) : (
          <ul className="space-y-2">
            {activeClient.orders.map(order => (
              <li key={order.id} className="flex justify-between items-center border-b pb-1">
                <span>{order.name} x{order.quantity} - ${order.price * order.quantity}</span>
                {order.notes && <span className="text-gray-500 text-sm ml-2">({order.notes})</span>}
                <button onClick={() => removeOrder(activeClient.id, order.id)} className="text-red-500">Eliminar</button>
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
          {isLocked ? 'Enviando...' : 'Enviar a cocina'}
        </button>
      </div>
    </div>
  );
};

export default OccupyTable;