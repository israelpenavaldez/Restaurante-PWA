import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { createOrder, updateTable, getMenuCategories } from '../../services/firestoreService';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { usePermissions } from '../../hooks/usePermissions';
import { useActionLock } from '../../hooks/useActionLock';
import { groupItemsForDisplay } from '../../utils/helpers';
import Card from '../ui/Card';
import Button from '../ui/Button';


const OccupyTable = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { userData } = useAuth();
  const { checkWaiter } = usePermissions();
  const { withLock, isLocked } = useActionLock();
  const { notify, prompt } = useNotification();

  const [clients, setClients] = useState([]);
  const [activeClientId, setActiveClientId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [productQuantities, setProductQuantities] = useState({});
  const [productNotes, setProductNotes] = useState({});
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [realTableNumber, setRealTableNumber] = useState(null);

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
    const fetchMenu = async () => {
      const cats = await getMenuCategories();
      const activeCats = cats.filter(cat => cat.active !== false);
      activeCats.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(activeCats);
      if (activeCats.length > 0) setSelectedCategory(activeCats[0].id);
      setLoadingMenu(false);
    };
    fetchMenu();
  }, []);

  useEffect(() => {
    if (clients.length === 0 && !loadingMenu && realTableNumber !== null) {
      const now = new Date();
      const formattedDate = now.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const formattedTime = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '-');
      const generatedName = `M${realTableNumber}-${formattedDate}-${formattedTime}`;
      const firstClient = { id: Date.now(), name: generatedName, orders: [] };
      setClients([firstClient]);
      setActiveClientId(firstClient.id);
    }
  }, [loadingMenu, realTableNumber, clients.length]);

  const handleAddClient = async () => {
    const newName = await prompt('Ingrese el nombre del nuevo cliente (obligatorio):');
    if (!newName || newName.trim() === '') {
      notify('El nombre es obligatorio para órdenes adicionales', 'warning');
      return;
    }
    const newClient = { id: Date.now(), name: newName.trim(), orders: [] };
    setClients(prev => [...prev, newClient]);
    setActiveClientId(newClient.id);
  };

  const handleRemoveClient = (clientId) => {
    if (clients.length === 1) {
      notify('No se puede eliminar el último cliente.', 'warning');
      return;
    }
    setClients(prev => prev.filter(c => c.id !== clientId));
    if (activeClientId === clientId) setActiveClientId(clients[0].id);
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

  const removeOrders = (clientId, itemIds) => {
    setClients(prev => prev.map(c =>
      c.id === clientId ? { ...c, orders: c.orders.filter(o => !itemIds.includes(o.id)) } : c
    ));
  };

  const handleSubmit = () => {
    withLock(async () => {
      try {
        checkWaiter();
        if (realTableNumber === null) {
          notify('Error: número de mesa no disponible', 'error');
          return;
        }
        for (const client of clients) {
          if (client.orders.length === 0) {
            notify(`El cliente ${client.name || 'desconocido'} no tiene productos`, 'warning');
            return;
          }
          if (clients.length > 1 && (!client.name || client.name.trim() === '')) {
            notify('Todos los clientes adicionales deben tener nombre', 'warning');
            return;
          }
        }
        for (const client of clients) {
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
            batches: [{ batchId: 1, timestamp: Timestamp.now(), status: 'pending', items: client.orders, deliveredAt: null }],
            status: 'pending',
            prepaid: false,
            createdAt: Timestamp.now(),
            deliveredAt: null,
            completedAt: null,
            total: client.orders.reduce((sum, item) => sum + item.price * item.quantity, 0)
          };
          await createOrder(orderData);
        }
        await updateTable(tableId, { status: 'occupied', occupiedSince: Timestamp.now() });
        notify('Órdenes enviadas a cocina', 'success');
        navigate('/dashboard');
      } catch (permError) {
        notify(permError.message, 'error');
        navigate('/dashboard');
      }
    }, (error) => notify(error.message, 'error'));
  };

  const activeClient = clients.find(c => c.id === activeClientId);
  const currentCategory = categories.find(cat => cat.id === selectedCategory);
  const products = (currentCategory?.items || []).filter(item => item.active !== false);
  const sortedProducts = [...products].sort((a, b) => a.name.localeCompare(b.name));

  if (loadingMenu || clients.length === 0 || realTableNumber === null) {
    return <div className="text-center mt-10 text-tierra-clara">Cargando...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 bg-crema min-h-screen">
      <button onClick={() => navigate('/dashboard')} className="text-chile-guajillo hover:text-red-800 font-medium mb-4 inline-flex items-center gap-1">
        ← Volver
      </button>
      <h2 className="text-3xl font-display font-bold text-chocolate-oscuro mb-6">Ocupar Mesa {realTableNumber}</h2>

      <div className="flex flex-wrap gap-2 mb-6">
        {clients.map(client => (
          <div key={client.id} className="relative">
            <button
              onClick={() => setActiveClientId(client.id)}
              className={`px-4 py-2 rounded-full font-medium transition ${
                activeClientId === client.id
                  ? 'bg-chile-guajillo text-white shadow-md'
                  : 'bg-barro-claro/30 text-chocolate-oscuro hover:bg-barro-claro/50'
              }`}
            >
              {client.name || 'Cliente sin nombre'}
            </button>
            <button
              onClick={() => handleRemoveClient(client.id)}
              className="absolute -top-2 -right-2 bg-chile-guajillo text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow"
              title="Eliminar cliente"
            >
              ×
            </button>
          </div>
        ))}
        <button onClick={handleAddClient} className="bg-verde-nopal text-white px-4 py-2 rounded-full font-semibold hover:bg-green-700 transition">
          + Nueva orden
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Nombre del cliente (opcional solo para el primer cliente)"
          value={activeClient?.name || ''}
          onChange={(e) => updateClientName(activeClient.id, e.target.value)}
          className="w-full p-2 border-b-2 border-barro-claro bg-white/80 rounded-t-md text-chocolate-oscuro placeholder:text-tierra-clara focus:border-chile-guajillo focus:outline-none transition"
        />
        {clients.length > 1 && (
          <p className="text-xs text-chile-guajillo mt-1">* Los clientes adicionales deben tener nombre</p>
        )}
      </div>

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
              <input
                type="number"
                min="1"
                value={productQuantities[product.id] || 1}
                onChange={(e) => setProductQuantities({ ...productQuantities, [product.id]: parseInt(e.target.value) || 1 })}
                className="w-full p-1 border border-barro-claro rounded-md text-center text-chocolate-oscuro"
              />
              <input
                type="text"
                placeholder="Modificaciones"
                value={productNotes[product.id] || ''}
                onChange={(e) => setProductNotes({ ...productNotes, [product.id]: e.target.value })}
                className="w-full p-1 border border-barro-claro rounded-md text-center text-chocolate-oscuro placeholder:text-tierra-clara text-sm"
              />
              <Button
                variant="primary"
                onClick={() => addProductToClient(activeClient.id, product, productQuantities[product.id] || 1, productNotes[product.id] || '')}
                className="w-full py-1"
              >
                Agregar
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Resumen del cliente activo */}
      <Card className="mb-6">
        <h3 className="font-display font-bold text-xl text-chocolate-oscuro mb-3"> Resumen de {activeClient?.name || 'cliente'} </h3>
        {activeClient?.orders.length === 0 ? (
          <p className="text-tierra-clara">No hay productos agregados</p>
        ) : (
          <ul className="space-y-2">
            {groupItemsForDisplay(activeClient.orders).map(group => (
              <li key={group.id} className="flex justify-between items-center border-b border-barro-claro/30 pb-2">
                <span className="text-chocolate-oscuro">
                  {group.name} x{group.quantity} - <span className="text-maiz-dorado font-bold">${group.price * group.quantity}</span>
                </span>
                {group.notes && <span className="text-tierra-clara text-sm ml-2">({group.notes})</span>}
                <button onClick={() => removeOrder(activeClient.id, group.id)} className="text-chile-guajillo hover:text-red-800 text-sm font-medium">
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex justify-end">
        <Button variant="success" onClick={handleSubmit} disabled={isLocked} className="px-8 py-3 text-lg">
          {isLocked ? 'Enviando...' : 'Enviar a cocina'}
        </Button>
      </div>
    </div>
  );
};

export default OccupyTable;