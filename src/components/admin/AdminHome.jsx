import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../context/NotificationContext';
import { getRealTotal, isOrderCompletelyCancelled } from '../../utils/helpers';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Toggle from '../ui/Toggle';
import { useAuth } from '../../context/AuthContext';

/**
 * Panel de inicio del administrador.
 * Muestra un resumen diario de ventas, órdenes, ticket promedio,
 * mesas ocupadas y los productos más vendidos.
 * También permite abrir o cerrar el servicio.
 */
const AdminHome = () => {
  // Métricas principales del día
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
  const [productSortBy, setProductSortBy] = useState('quantity'); // 'quantity' o 'total'
  const { notify, confirm } = useNotification();
  const { setIsServiceOpen } = useAuth();

  /**
   * Obtiene las métricas de ventas del día actual.
   * Consulta todas las órdenes pagadas o completadas del día,
   * calcula el total real (excluyendo cancelados) y agrupa
   * los productos para obtener los más vendidos.
   * @returns {Object} Métricas calculadas.
   */
  const fetchDailyMetrics = async () => {
    // Definir rango del día (00:00 a 23:59)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const startTimestamp = Timestamp.fromDate(startOfDay);
    const endTimestamp = Timestamp.fromDate(endOfDay);

    // Consultar órdenes del día
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

    // Ventas y promedios
    const dailySales = validOrders.reduce((sum, order) => sum + order.realTotal, 0);
    const ordersAttended = validOrders.length;
    const averageTicket = ordersAttended > 0 ? dailySales / ordersAttended : 0;

    // Agrupar productos por nombre y categoría
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

    // Ordenar según el criterio seleccionado (cantidad o monto)
    const sorted = Array.from(productMap.values()).sort((a, b) => {
      if (productSortBy === 'quantity') return b.quantity - a.quantity;
      return b.total - a.total;
    });

    return { dailySales, ordersAttended, averageTicket, topProducts: sorted.slice(0, 5) };
  };

  /** Cuenta las mesas actualmente ocupadas. */
  const fetchOccupiedTables = async () => {
    const snapshot = await getDocs(collection(db, 'tables'));
    return snapshot.docs.map(doc => doc.data()).filter(table => table.status === 'occupied').length;
  };

  /** Cuenta el total de mesas registradas. */
  const fetchTotalTables = async () => {
    const snapshot = await getDocs(collection(db, 'tables'));
    return snapshot.size;
  };

  /** Obtiene la configuración global del servicio. */
  const fetchConfig = async () => {
    const configDoc = await getDoc(doc(db, 'config', 'settings'));
    return configDoc.exists() ? configDoc.data() : { isServiceOpen: true };
  };

  /** Carga todas las métricas y configuración al montar el componente. */
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

  /**
   * Alterna el estado del servicio (abierto/cerrado).
   * No permite cerrar si hay mesas ocupadas y solicita confirmación.
   */
  const toggleServiceStatus = async () => {
    if (metrics.isServiceOpen && metrics.occupiedTables > 0) {
      notify(`No se puede cerrar porque hay ${metrics.occupiedTables} mesa(s) ocupada(s).`, 'warning');
      return;
    }
    const respuesta = await confirm('¿Estás seguro de cambiar el estado del servicio?');
    if (!respuesta) return;
    setUpdatingService(true);
    try {
      const newStatus = !metrics.isServiceOpen;
      await updateDoc(doc(db, 'config', 'settings'), { isServiceOpen: newStatus });
      setMetrics(prev => ({ ...prev, isServiceOpen: newStatus }));
      setIsServiceOpen(newStatus); // Actualiza el contexto global inmediatamente
      notify('Servicio actualizado', 'success');
    } catch (error) {
      console.error(error);
      notify('No se pudo cambiar el estado del servicio', 'error');
    } finally {
      setUpdatingService(false);
    }
  };

  // Estado de carga inicial
  if (loading) return <div className="text-center mt-10 text-texto-claro">Cargando métricas...</div>;

  return (
    <div>
      {/* ===== CABECERA CON BOTÓN DE SERVICIO ===== */}
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-display font-bold text-texto">Resumen del día</h2>
        <Toggle
          enabled={metrics.isServiceOpen}
          onChange={toggleServiceStatus}
          label={metrics.isServiceOpen ? 'Servicio abierto' : 'Servicio cerrado'}
          disabled={updatingService}
        />
      </div>

      {/* ===== TARJETAS DE MÉTRICAS PRINCIPALES ===== */}
      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-6 mb-8">
        <Card className="text-center">
          <h3 className="text-2xl text-texto font-display uppercase tracking-wide">Ventas del día</h3>
          <p className="text-2xl text-acento font-body font-medium mt-2">${metrics.dailySales.toFixed(2)}</p>
        </Card>
        <Card className="text-center">
          <h3 className="text-2xl text-texto font-display uppercase tracking-wide">Órdenes completadas</h3>
          <p className="text-2xl text-acento font-body font-medium mt-2">{metrics.ordersAttended}</p>
        </Card>
        <Card className="text-center">
          <h3 className="text-2xl text-texto font-display uppercase tracking-wide">Mesas ocupadas</h3>
          <p className="text-2xl text-acento font-body font-medium mt-2">{metrics.occupiedTables} / {metrics.totalTables}</p>
        </Card>
      </div>
    </div>
  );
};

export default AdminHome;