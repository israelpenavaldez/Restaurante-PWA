import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { createOrder, updateTable, getMenuCategories } from '../../services/firestoreService';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { usePermissions } from '../../hooks/usePermissions';
import { useActionLock } from '../../hooks/useActionLock';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import { groupItemsForDisplay } from '../../utils/helpers';
import Card from '../ui/Card';
import Button from '../ui/Button';

/**
 * Vista para atender una mesa libre.
 * Permite al mesero agregar uno o varios clientes, seleccionar categorías del menú,
 * añadir productos con cantidad y notas, y enviar las órdenes a cocina.
 * Al enviar, crea una orden por cada cliente y marca la mesa como ocupada.
 */
const OccupyTable = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { userData } = useAuth();
  const { checkWaiter } = usePermissions();
  const { withLock, isLocked } = useActionLock();
  const { notify, confirm, prompt } = useNotification();

  // ===== ESTADOS =====
  const [clients, setClients] = useState([]);                 // lista de clientes en la mesa
  const [activeClientId, setActiveClientId] = useState(null); // cliente seleccionado
  const [categories, setCategories] = useState([]);           // categorías del menú
  const [selectedCategory, setSelectedCategory] = useState('');
  const [productQuantities, setProductQuantities] = useState({});
  const [productNotes, setProductNotes] = useState({});
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [realTableNumber, setRealTableNumber] = useState(null);
  const isOnline = useOnlineStatus();

  // ===== CARGA INICIAL =====

  /**
   * Obtiene el número real de la mesa desde Firestore.
   * Si no se encuentra, redirige al panel principal.
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
   * Carga todas las categorías del menú y selecciona la primera por defecto.
   */
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

  /**
   * Crea automáticamente el primer cliente con un nombre generado
   * a partir del número de mesa y la hora actual.
   */
  useEffect(() => {
    if (clients.length === 0 && !loadingMenu && realTableNumber !== null) {
      const now = new Date();
      const formattedTime = now.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const generatedName = `M-${realTableNumber}-${formattedTime}`;
      const firstClient = { id: Date.now(), name: generatedName, orders: [] };
      setClients([firstClient]);
      setActiveClientId(firstClient.id);
    }
  }, [loadingMenu, realTableNumber, clients.length]);

  // ===== GESTIÓN DE CLIENTES =====

  /**
   * Agrega un nuevo cliente a la mesa.
   * Solicita el nombre mediante un prompt (obligatorio).
   */
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

  /**
   * Elimina un cliente de la mesa.
   * No permite eliminar al último cliente restante.
   * @param {number} clientId - ID del cliente a eliminar.
   */
  const handleRemoveClient = (clientId) => {
    if (clients.length === 1) {
      notify('No se puede eliminar el último cliente.', 'warning');
      return;
    }
    setClients(prev => prev.filter(c => c.id !== clientId));
    if (activeClientId === clientId) setActiveClientId(clients[0].id);
  };

  /**
   * Actualiza el nombre de un cliente existente.
   * @param {number} clientId - ID del cliente.
   * @param {string} name - Nuevo nombre del cliente.
   */
  const updateClientName = (clientId, name) => {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, name } : c));
  };

  // ===== GESTIÓN DE PRODUCTOS =====

  /**
   * Agrega un producto a la orden del cliente seleccionado.
   * @param {number} clientId - ID del cliente.
   * @param {Object} product - Producto seleccionado.
   * @param {number} quantity - Cantidad del producto.
   * @param {string} notes - Notas de modificación opcionales.
   */
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

  /**
   * Elimina uno o varios productos de la orden de un cliente.
   * @param {number} clientId - ID del cliente.
   * @param {number[]} itemIds - IDs de los productos a eliminar.
   */
  const removeOrders = (clientId, itemIds) => {
    setClients(prev => prev.map(c =>
      c.id === clientId ? { ...c, orders: c.orders.filter(o => !itemIds.includes(o.id)) } : c
    ));
  };

  // ===== ENVÍO A COCINA =====

  /**
   * Envía las órdenes de todos los clientes a cocina.
   * Valida que cada cliente tenga al menos un producto y que los clientes
   * adicionales tengan nombre. Crea una orden por cliente y marca la mesa como ocupada.
   */
  const handleSubmit = () => {
    withLock(async () => {
      try {
        checkWaiter();

        if (realTableNumber === null) {
          notify('Error: número de mesa no disponible', 'error');
          return;
        }

        // Validar que cada cliente tenga productos
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

        // Confirmación antes de enviar
        const ok = await confirm('¿Enviar las órdenes a cocina?');
        if (!ok) return;

        // Crear una orden por cada cliente
        for (const client of clients) {
          let finalClientName;
          if (client.name && client.name.trim() !== '') {
            finalClientName = client.name.trim();
          } else {
            // Nombre generado para el cliente principal sin nombre
            const now = new Date();
            const formattedTime = now.toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });
            finalClientName = `M-${realTableNumber}-${formattedTime}`;
          }

          const orderData = {
            tableId: tableId,
            tableNumber: realTableNumber,
            clientName: finalClientName,
            batches: [{
              batchId: 1,
              timestamp: Timestamp.now(),
              status: 'pending',
              items: client.orders,
              deliveredAt: null
            }],
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
        notify('Órdenes enviadas a cocina', 'success');
        navigate('/dashboard');
      } catch (permError) {
        notify(permError.message, 'error');
        navigate('/dashboard');
      }
    }, (error) => notify(error.message, 'error'));
  };

  // ===== DATOS DE LA VISTA =====

  const activeClient = clients.find(c => c.id === activeClientId);
  const currentCategory = categories.find(cat => cat.id === selectedCategory);
  const products = currentCategory?.items || [];
  const sortedProducts = [...products].sort((a, b) => a.name.localeCompare(b.name));

  // ===== RENDERIZADO =====

  if (loadingMenu || clients.length === 0 || realTableNumber === null) {
    return <div className="text-center mt-10 text-texto-claro">Cargando...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 bg-fondo min-h-screen">
      {/* ===== BOTÓN VOLVER ===== */}
      <Button 
        variant="return"
        onClick={() => navigate('/dashboard')} 
        className= "mb-6">
          ←
      </Button>

      <h2 className="text-3xl font-display font-bold text-texto mb-6">Mesa: {realTableNumber}</h2>

      {/* ===== PÍLDORAS DE CLIENTES ===== */}
      <div className="flex flex-wrap gap-2 mb-6">
        {clients.map(client => (
          <div key={client.id} className="relative">
            <button
              onClick={() => setActiveClientId(client.id)}
              className={`px-4 py-2 rounded-full font-medium transition ${
                activeClientId === client.id
                  ? 'bg-acento text-texto-inverso shadow-md'
                  : 'bg-tarjeta-alt/30 text-texto hover:bg-tarjeta-alt/50'
              }`}
            >
              {client.name || 'Cliente sin nombre'}
            </button>
            {/* Botón para eliminar cliente */}
            <button
              onClick={() => handleRemoveClient(client.id)}
              className="absolute -top-2 -right-2 bg-acento text-texto-inverso rounded-full w-5 h-5 flex items-center justify-center text-xs shadow"
              title="Eliminar cliente"
            >
              ×
            </button>
          </div>
        ))}
        {/* Botón para agregar cliente adicional */}
        <button
          onClick={handleAddClient}
          className="bg-boton-exito hover:bg-boton-exito-hover text-boton-exito-texto px-4 py-2 rounded-full font-semibold transition"
        >
          + Orden adicional
        </button>
      </div>

      {/* ===== NOMBRE DEL CLIENTE ACTIVO ===== */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Nombre del cliente (opcional solo para el primer cliente)"
          value={activeClient?.name || ''}
          onChange={(e) => updateClientName(activeClient.id, e.target.value)}
          className="w-full p-2 border-b-2 border-borde bg-white/80 rounded-t-md text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none transition"
        />
        {clients.length > 1 && (
          <p className="text-xs text-acento mt-1">* Los clientes adicionales deben tener nombre</p>
        )}
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
                variant="success"
                onClick={() => addProductToClient(activeClient.id, product, productQuantities[product.id] || 1, productNotes[product.id] || '')}
                className="w-full py-1"
                disabled={product.active === false || isLocked}
              >
                Agregar
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* ===== RESUMEN DEL CLIENTE ACTIVO ===== */}
      <Card className="mb-6">
        <h3 className="font-display font-bold text-xl text-texto mb-3">Resumen de {activeClient?.name || 'cliente'}</h3>
        {activeClient?.orders.length === 0 ? (
          <p className="text-texto-claro">No hay productos agregados</p>
        ) : (
          <ul className="space-y-2">
            {groupItemsForDisplay(activeClient.orders).map(group => (
              <li key={group.ids[0]} className="flex justify-between items-center border-b border-borde-claro pb-2">
                <span className="text-texto">
                  {group.name} x{group.quantity} - <span className="text-texto-aviso font-bold">${group.price * group.quantity}</span>
                </span>
                {group.notes && <span className="text-texto-claro text-sm ml-2">({group.notes})</span>}
                <Button
                  variant="cancel"
                  onClick={() => removeOrders(activeClient.id, group.ids)} 
                  className="text-sm py-1 px-2">
                    {/* Ícono de X */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ===== BOTÓN ENVIAR A COCINA ===== */}
      <div className="flex justify-end">
        <Button 
          variant="success" 
          onClick={handleSubmit} 
          disabled={isLocked || !isOnline} 
          className="px-8 py-3 text-lg">
            {isLocked ? 'Enviando...' : 'Enviar a cocina'}
        </Button>
      </div>
    </div>
  );
};

export default OccupyTable;