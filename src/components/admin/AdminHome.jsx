import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../context/NotificationContext';
import { getRealTotal, isOrderCompletelyCancelled } from '../../utils/helpers';
import Card from '../ui/Card';
import Button from '../ui/Button';

const AdminHome = () => {
  const [metrics, setMetrics] = useState({
    dailySales: 0,
    ordersAttended: 0,
    averageTicket: 0,
    topProducts: [],
    occupiedTables: 0,
    totalTables: 8,
    isServiceOpen: true,
  });
  const [loading, setLoading] = useState(true);
  const [updatingService, setUpdatingService] = useState(false);
  const [productSortBy, setProductSortBy] = useState('quantity');
  const { notify, confirm } = useNotification();

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
    ordersData = ordersData.map(order => ({ ...order, realTotal: getRealTotal(order) }));
    const validOrders = ordersData.filter(order => !isOrderCompletelyCancelled(order));

    const dailySales = validOrders.reduce((sum, order) => sum + order.realTotal, 0);
    const ordersAttended = validOrders.length;
    const averageTicket = ordersAttended > 0 ? dailySales / ordersAttended : 0;

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
    const sorted = Array.from(productMap.values()).sort((a, b) => {
      if (productSortBy === 'quantity') return b.quantity - a.quantity;
      return b.total - a.total;
    });
    return { dailySales, ordersAttended, averageTicket, topProducts: sorted.slice(0, 5) };
  };

  const fetchOccupiedTables = async () => {
    const snapshot = await getDocs(collection(db, 'tables'));
    return snapshot.docs.map(doc => doc.data()).filter(table => table.status === 'occupied').length;
  };

  const fetchTotalTables = async () => {
    const snapshot = await getDocs(collection(db, 'tables'));
    return snapshot.size;
  };

  const fetchConfig = async () => {
    const configDoc = await getDoc(doc(db, 'config', 'settings'));
    return configDoc.exists() ? configDoc.data() : { isServiceOpen: true };
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [dailyMetrics, occupied, total, config] = await Promise.all([
          fetchDailyMetrics(),
          fetchOccupiedTables(),
          fetchTotalTables(),
          fetchConfig(),
        ]);
        setMetrics({ ...dailyMetrics, occupiedTables: occupied, totalTables: total, isServiceOpen: config.isServiceOpen });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [productSortBy]);

  const toggleServiceStatus = async () => {
    if (metrics.isServiceOpen && metrics.occupiedTables > 0) {
      notify(`No se puede cerrar porque hay ${metrics.occupiedTables} mesa(s) ocupada(s).`, 'warning');
      return;
    }
    const respuesta = await confirm('¿Estás seguro de cambiar el estado del servicio?');
    if (!respuesta) return;
    setUpdatingService(true);
    notify('Servicio actualizado', 'success');
    try {
      const newStatus = !metrics.isServiceOpen;
      await updateDoc(doc(db, 'config', 'settings'), { isServiceOpen: newStatus });
      setMetrics(prev => ({ ...prev, isServiceOpen: newStatus }));
    } catch (error) {
      console.error(error);
      notify('No se pudo cambiar el estado del servicio', 'error');
    } finally {
      setUpdatingService(false);
    }
  };

  if (loading) return <div className="text-center mt-10 text-tierra-clara">Cargando métricas...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-display font-bold text-chocolate-oscuro">Resumen del día</h2>
        <Button
          variant={metrics.isServiceOpen ? 'success' : 'primary'}
          onClick={toggleServiceStatus}
          disabled={updatingService}
        >
          {metrics.isServiceOpen ? '🔓 Servicio abierto' : '🔒 Servicio cerrado'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="text-center">
          <h3 className="text-tierra-clara text-sm font-medium uppercase tracking-wide">Ventas del día</h3>
          <p className="text-3xl font-display font-bold text-chile-guajillo mt-2">${metrics.dailySales.toFixed(2)}</p>
        </Card>
        <Card className="text-center">
          <h3 className="text-tierra-clara text-sm font-medium uppercase tracking-wide">Órdenes completadas</h3>
          <p className="text-3xl font-display font-bold text-chocolate-oscuro mt-2">{metrics.ordersAttended}</p>
        </Card>
        <Card className="text-center">
          <h3 className="text-tierra-clara text-sm font-medium uppercase tracking-wide">Ticket promedio</h3>
          <p className="text-3xl font-display font-bold text-chocolate-oscuro mt-2">${metrics.averageTicket.toFixed(2)}</p>
        </Card>
        <Card className="text-center">
          <h3 className="text-tierra-clara text-sm font-medium uppercase tracking-wide">Mesas ocupadas</h3>
          <p className="text-3xl font-display font-bold text-chocolate-oscuro mt-2">{metrics.occupiedTables} / {metrics.totalTables}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-display font-bold text-chocolate-oscuro">5 productos más vendidos (hoy)</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-tierra-clara">Ordenar por:</span>
              <select
                value={productSortBy}
                onChange={(e) => setProductSortBy(e.target.value)}
                className="p-1 border-b-2 border-barro-claro bg-transparent text-chocolate-oscuro text-sm focus:border-chile-guajillo focus:outline-none"
              >
                <option value="quantity">Cantidad</option>
                <option value="total">Monto</option>
              </select>
            </div>
          </div>
          {metrics.topProducts.length === 0 ? (
            <p className="text-tierra-clara">No hay ventas registradas hoy.</p>
          ) : (
            <ul className="space-y-2">
              {metrics.topProducts.map((product, idx) => (
                <li key={idx} className="flex justify-between items-center border-b border-barro-claro/20 pb-2">
                  <div>
                    <span className="font-medium text-chocolate-oscuro">{product.name}</span>
                    <span className="text-xs text-tierra-clara ml-1">({product.category})</span>
                  </div>
                  <div className="text-right text-sm">
                    <span className="font-medium">{product.quantity} uds</span>
                    <span className="text-tierra-clara ml-2">${product.total.toFixed(2)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="text-lg font-display font-bold text-chocolate-oscuro mb-4">Resumen rápido</h3>
          <p className="text-tierra-clara">Las métricas detalladas se encuentran en la pestaña <strong className="text-chocolate-oscuro">Reportes</strong>.</p>
          <p className="text-tierra-clara mt-2">El análisis completo de productos está disponible en la exportación a PDF.</p>
        </Card>
      </div>
    </div>
  );
};

export default AdminHome;