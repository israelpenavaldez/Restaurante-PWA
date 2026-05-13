import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';

const AdminHome = () => {
  const [metrics, setMetrics] = useState({
    dailySales: 0,
    ordersAttended: 0,
    averageTicket: 0,
    topProducts: [],      // { name, category, quantity, total }
    occupiedTables: 0,
    totalTables: 8,
    isServiceOpen: true,
  });
  const [loading, setLoading] = useState(true);
  const [updatingService, setUpdatingService] = useState(false);
  const [productSortBy, setProductSortBy] = useState('quantity'); // 'quantity' or 'total'

  // Función para obtener el total real de una orden (excluyendo cancelados)
  const getRealTotal = (order) => {
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

  // Determinar si una orden está completamente cancelada (todos los items cancelados)
  const isOrderCompletelyCancelled = (order) => {
    if (!order.batches || order.batches.length === 0) return false;
    return order.batches.every(batch =>
      batch.items.every(item => item.status === 'cancelled')
    );
  };

  // Obtener métricas del día actual (desde 00:00 hasta ahora)
  const fetchDailyMetrics = async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const startTimestamp = Timestamp.fromDate(startOfDay);
    const endTimestamp = Timestamp.fromDate(endOfDay);

    const q = query(
      collection(db, 'orders'),
      where('createdAt', '>=', startTimestamp),
      where('createdAt', '<=', endTimestamp),
      where('status', 'in', ['paid', 'completed'])
    );
    const snapshot = await getDocs(q);
    let ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Calcular total real para cada orden
    ordersData = ordersData.map(order => ({
      ...order,
      realTotal: getRealTotal(order)
    }));
    // Excluir órdenes completamente canceladas
    const validOrders = ordersData.filter(order => !isOrderCompletelyCancelled(order));

    const dailySales = validOrders.reduce((sum, order) => sum + order.realTotal, 0);
    const ordersAttended = validOrders.length;
    const averageTicket = ordersAttended > 0 ? dailySales / ordersAttended : 0;

    // Productos más vendidos (agrupando por categoría y nombre)
    const productMap = new Map();
    validOrders.forEach(order => {
      order.batches?.forEach(batch => {
        batch.items.forEach(item => {
          if (item.status !== 'cancelled') {
            const category = item.category || 'General';
            const key = `${category}::${item.name}`;
            if (!productMap.has(key)) {
              productMap.set(key, { category, name: item.name, quantity: 0, total: 0 });
            }
            const prod = productMap.get(key);
            prod.quantity += item.quantity;
            prod.total += item.price * item.quantity;
          }
        });
      });
    });
    const productsArray = Array.from(productMap.values());
    const sortedProducts = [...productsArray].sort((a, b) => {
      if (productSortBy === 'quantity') return b.quantity - a.quantity;
      else return b.total - a.total;
    });
    const topProducts = sortedProducts.slice(0, 5);

    return { dailySales, ordersAttended, averageTicket, topProducts };
  };

  const fetchOccupiedTables = async () => {
    const tablesSnapshot = await getDocs(collection(db, 'tables'));
    const tables = tablesSnapshot.docs.map(doc => doc.data());
    return tables.filter(table => table.status === 'occupied').length;
  };

  const fetchConfig = async () => {
    const configDoc = await getDoc(doc(db, 'config', 'settings'));
    if (configDoc.exists()) {
      return configDoc.data();
    }
    return { totalTables: 8, isServiceOpen: true };
  };

  // Contar todas las mesas
  const fetchTotalTables = async () => {
    const tablesSnapshot = await getDocs(collection(db, 'tables'));
    return tablesSnapshot.size; // número total de documentos
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [dailyMetrics, occupiedTables, totalTables, config] = await Promise.all([
          fetchDailyMetrics(),
          fetchOccupiedTables(),
          fetchTotalTables(),
          fetchConfig(),
        ]);
        setMetrics({
          ...dailyMetrics,
          occupiedTables,
          totalTables,
          isServiceOpen: config.isServiceOpen,
        });
      } catch (error) {
        console.error('Error cargando métricas:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [productSortBy]); // Recargar cuando cambie el orden de productos

  const toggleServiceStatus = async () => {
    if (metrics.isServiceOpen && metrics.occupiedTables > 0) {
      alert(`No se puede cerrar el servicio porque hay ${metrics.occupiedTables} mesa(s) ocupada(s).`);
      return;
    }
    setUpdatingService(true);
    try {
      const newStatus = !metrics.isServiceOpen;
      await updateDoc(doc(db, 'config', 'settings'), { isServiceOpen: newStatus });
      setMetrics(prev => ({ ...prev, isServiceOpen: newStatus }));
    } catch (error) {
      console.error(error);
      alert('No se pudo cambiar el estado del servicio');
    } finally {
      setUpdatingService(false);
    }
  };

  if (loading) return <div className="text-center mt-10">Cargando métricas...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Resumen del día</h2>
        <button
          onClick={toggleServiceStatus}
          disabled={updatingService}
          className={`px-4 py-2 rounded text-white ${metrics.isServiceOpen ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
        >
          {metrics.isServiceOpen ? '🔓 Servicio abierto' : '🔒 Servicio cerrado'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm font-medium">Ventas del día</h3>
          <p className="text-3xl font-bold text-gray-900">${metrics.dailySales.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm font-medium">Órdenes completadas</h3>
          <p className="text-3xl font-bold text-gray-900">{metrics.ordersAttended}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm font-medium">Ticket promedio</h3>
          <p className="text-3xl font-bold text-gray-900">${metrics.averageTicket.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm font-medium">Mesas ocupadas</h3>
          <p className="text-3xl font-bold text-gray-900">{metrics.occupiedTables} / {metrics.totalTables}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">5 productos más vendidos (hoy)</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Ordenar por:</span>
              <select
                value={productSortBy}
                onChange={(e) => setProductSortBy(e.target.value)}
                className="p-1 border rounded text-sm"
              >
                <option value="quantity">Cantidad vendida</option>
                <option value="total">Monto total</option>
              </select>
            </div>
          </div>
          {metrics.topProducts.length === 0 ? (
            <p className="text-gray-500">No hay ventas registradas hoy.</p>
          ) : (
            <ul className="space-y-2">
              {metrics.topProducts.map((product, idx) => (
                <li key={idx} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <span className="font-medium">{product.name}</span>
                    <span className="text-xs text-gray-500 ml-1">({product.category})</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">{product.quantity} uds</span>
                    <span className="text-gray-500 ml-2">${product.total.toFixed(2)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Podrías agregar aquí otro bloque si quieres, por ejemplo tiempo promedio del día */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Resumen rápido</h3>
          <p className="text-gray-600">Las métricas detalladas se encuentran en la pestaña <strong>Reportes</strong>.</p>
          <p className="text-gray-600 mt-2">El análisis completo de productos (incluyendo no vendidos) está disponible en la exportación a PDF de reportes.</p>
        </div>
      </div>
    </div>
  );
};

export default AdminHome;