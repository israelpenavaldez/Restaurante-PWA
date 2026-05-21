import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getRealTotal, isOrderCompletelyCancelled } from '../../utils/helpers';

const AdminReports = () => {
  const [filter, setFilter] = useState('day');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0,10));
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const weekNum = getWeekNumber(now);
    return `${year}-W${String(weekNum).padStart(2, '0')}`;
  });
  function getWeekNumber(d) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  }
  function getWeekRange(year, weekNumber) {
    // Calcular fecha del primer día del año
    const firstDayOfYear = new Date(year, 0, 1);
    const daysOffset = (firstDayOfYear.getDay() + 6) % 7; // 0=lunes
    const firstMonday = new Date(year, 0, 1 + (daysOffset === 0 ? 0 : 7 - daysOffset));
    const monday = new Date(firstMonday);
    monday.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { monday, sunday };
  }
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  });
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [allOrders, setAllOrders] = useState([]);
  const [validOrders, setValidOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState({ 
    totalSales:0, 
    totalOrders:0, 
    averageTicket:0, 
    averageServiceTime:0,
    averageBatchTime:0 
  });
  const [topProducts, setTopProducts] = useState([]);
  const [bottomProducts, setBottomProducts] = useState([]);
  const [productSortBy, setProductSortBy] = useState('quantity'); // 'quantity' or 'total'
  const [showOrdersTable, setShowOrdersTable] = useState(false);

  const getPaymentDate = (order) => {
    if (order.completedAt) return order.completedAt.toDate();
    if (order.paidAt) return order.paidAt.toDate();
    return null;
  };

  useEffect(() => {
    let start, end;
    if (filter === 'day') {
      // Usar horario local para evitar desfase UTC
      const [year, month, day] = selectedDate.split('-').map(Number);
      start = new Date(year, month-1, day, 0, 0, 0, 0);
      end = new Date(year, month-1, day, 23, 59, 59, 999);
    } else if (filter === 'week') {
      const [year, weekStr] = selectedWeek.split('-W');
      const weekNumber = parseInt(weekStr, 10);
      const { monday, sunday } = getWeekRange(parseInt(year), weekNumber);
      start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, 0);
      end = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 23, 59, 59, 999);
    } else {
      const [year, month] = selectedMonth.split('-');
      start = new Date(parseInt(year), parseInt(month)-1, 1, 0, 0, 0, 0);
      end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
    }
    setStartDate(start);
    setEndDate(end);
  }, [filter, selectedDate, selectedWeek, selectedMonth]);

  useEffect(() => {
    if (!startDate || !endDate) return;
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const startTimestamp = Timestamp.fromDate(startDate);
        const endTimestamp = Timestamp.fromDate(endDate);
        const q = query(
          collection(db, 'orders'),
          where('createdAt', '>=', startTimestamp),
          where('createdAt', '<=', endTimestamp),
          where('status', 'in', ['paid', 'completed'])
        );
        const snapshot = await getDocs(q);
        let allOrdersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allOrdersData = allOrdersData.map(order => ({
          ...order,
          realTotal: getRealTotal(order)
        }));
        const validOrdersData = allOrdersData.filter(order => !isOrderCompletelyCancelled(order));
        
        setAllOrders(allOrdersData);
        setValidOrders(validOrdersData);

        const totalSales = validOrdersData.reduce((sum, o) => sum + o.realTotal, 0);
        const totalOrders = validOrdersData.length;
        const averageTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
        
        let totalAverageTime = 0;
        let ordersWithTime = 0;
        let totalBatchMinutes = 0;
        let totalBatches = 0;

        validOrdersData.forEach(order => {
          let sumBatchTimes = 0;
          let batchCount = 0;
          order.batches?.forEach(batch => {
            if (batch.timestamp && batch.deliveredAt) {
              const start = batch.timestamp.toDate();
              const end = batch.deliveredAt.toDate();
              const batchMinutes = (end - start) / (1000 * 60);
              sumBatchTimes += batchMinutes;
              batchCount++;
              totalBatchMinutes += batchMinutes;
              totalBatches++;
            }
          });
          if (batchCount > 0) {
            const orderAverage = sumBatchTimes / batchCount;
            totalAverageTime += orderAverage;
            ordersWithTime++;
          }
        });
        const averageServiceTime = ordersWithTime > 0 ? totalAverageTime / ordersWithTime : 0;
        const averageBatchTime = totalBatches > 0 ? totalBatchMinutes / totalBatches : 0;

        setMetrics({ totalSales, totalOrders, averageTicket, averageServiceTime, averageBatchTime });

        // Productos vendidos (todos)
        const productMap = new Map();
        validOrdersData.forEach(order => {
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
        const sortedProducts = Array.from(productMap.values()).sort((a,b) => {
          if (productSortBy === 'quantity') return b.quantity - a.quantity;
          else return b.total - a.total;
        });
        setTopProducts(sortedProducts.slice(0,5));
        
        const bottom = [...sortedProducts].sort((a, b) => {
          if (productSortBy === 'quantity') return a.quantity - b.quantity;
          else return a.total - b.total;
        }).slice(0, 5);
        setBottomProducts(bottom);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [startDate, endDate, filter, productSortBy]);

  const exportToExcel = () => {
    const data = allOrders.map(order => ({
      Cliente: order.clientName,
      Mesa: order.tableNumber,
      'Fecha creación': order.createdAt?.toDate().toLocaleString(),
      'Fecha pago': getPaymentDate(order)?.toLocaleString() || '',
      'Total real': order.realTotal,
      Estado: order.status
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, `reporte_${filter}_${startDate?.toISOString().slice(0,10)}.xlsx`);
  };

  const exportToPDF = async () => {
    // Obtener todos los productos del menú (para listar no vendidos)
    const menuSnapshot = await getDocs(collection(db, 'menuCategories'));
    const allMenuItems = [];
    menuSnapshot.forEach(catDoc => {
      const category = catDoc.data().name;
      const items = catDoc.data().items || [];
      items.forEach(item => {
        allMenuItems.push({ category, name: item.name });
      });
    });

    // Productos vendidos (ya los tenemos en topProducts? No, topProducts son solo 5. Recalcular todos vendidos)
    // Recolectar nuevamente todos los productos vendidos desde validOrders
    const soldMap = new Map();
    validOrders.forEach(order => {
      order.batches?.forEach(batch => {
        batch.items.forEach(item => {
          if (item.status !== 'cancelled') {
            const key = `${item.category || 'General'}::${item.name}`;
            if (!soldMap.has(key)) {
              soldMap.set(key, { category: item.category || 'General', name: item.name, quantity: 0, total: 0 });
            }
            const prod = soldMap.get(key);
            prod.quantity += item.quantity;
            prod.total += item.price * item.quantity;
          }
        });
      });
    });
    const soldProducts = Array.from(soldMap.values()).sort((a,b) => b.quantity - a.quantity);
    
    // Productos no vendidos: los que están en allMenuItems pero no en soldMap
    const unsoldProducts = allMenuItems.filter(menuItem => {
      const key = `${menuItem.category}::${menuItem.name}`;
      return !soldMap.has(key);
    });

    const doc = new jsPDF();
    doc.text(`Reporte de ventas - ${filter.toUpperCase()}`, 14, 10);
    doc.text(`Período: ${startDate?.toLocaleDateString()} - ${endDate?.toLocaleDateString()}`, 14, 20);
    doc.text(`Ventas totales: $${metrics.totalSales.toFixed(2)}`, 14, 30);
    doc.text(`Órdenes completadas: ${metrics.totalOrders}`, 14, 40);
    doc.text(`Ticket promedio: $${metrics.averageTicket.toFixed(2)}`, 14, 50);
    doc.text(`Tiempo promedio por orden: ${metrics.averageServiceTime.toFixed(0)} minutos`, 14, 60);
    doc.text(`Tiempo promedio por lote: ${metrics.averageBatchTime.toFixed(0)} minutos`, 14, 70);

    let y = 80;
    // Tabla de órdenes resumida
    autoTable(doc, {
      startY: y,
      head: [['Cliente','Mesa','Fecha creación','Fecha pago','Total real']],
      body: allOrders.map(o => [
        o.clientName,
        o.tableNumber,
        o.createdAt?.toDate().toLocaleString(),
        getPaymentDate(o)?.toLocaleString() || '',
        `$${o.realTotal}`
      ])
    });
    y = doc.lastAutoTable.finalY + 10;

    // Todos los productos vendidos
    doc.text('Todos los productos vendidos', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Categoría','Producto','Unidades','Monto total']],
      body: soldProducts.map(p => [p.category, p.name, p.quantity, `$${p.total.toFixed(2)}`])
    });
    y = doc.lastAutoTable.finalY + 10;

    // Productos no vendidos
    if (unsoldProducts.length > 0) {
      doc.text('Productos no vendidos en el período', 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [['Categoría','Producto']],
        body: unsoldProducts.map(p => [p.category, p.name])
      });
    } else {
      doc.text('No hay productos no vendidos en el período.', 14, y);
    }

    doc.save(`reporte_${filter}_${startDate?.toISOString().slice(0,10)}.pdf`);
  };

  if (loading) return <div className="text-center mt-10">Cargando reportes...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Reportes de ventas</h2>
        <div className="space-x-2">
          <button onClick={exportToExcel} className="bg-green-600 text-white px-3 py-1 rounded">Exportar Excel</button>
          <button onClick={exportToPDF} className="bg-red-600 text-white px-3 py-1 rounded">Exportar PDF</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block font-medium">Tipo</label>
            <div className="flex space-x-2">
              {['day','week','month'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setFilter(opt)}
                  className={`px-4 py-2 rounded ${filter === opt ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                >
                  {opt === 'day' ? 'Día' : opt === 'week' ? 'Semana' : 'Mes'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block font-medium">
              {filter === 'day' ? 'Fecha' : filter === 'week' ? 'Inicio de semana' : 'Mes'}
            </label>
            {filter === 'day' && (
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="p-2 border rounded"
              />
            )}
            {filter === 'week' && (
              <input
                type="week"
                value={selectedWeek}
                onChange={e => setSelectedWeek(e.target.value)}
                className="p-2 border rounded"
              />
            )}
            {filter === 'month' && (
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="p-2 border rounded"
              />
            )}
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Período: {startDate?.toLocaleDateString()} - {endDate?.toLocaleDateString()}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-gray-500 text-sm">Ventas totales</h3>
          <p className="text-2xl font-bold">${metrics.totalSales.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-gray-500 text-sm">Órdenes completadas</h3>
          <p className="text-2xl font-bold">{metrics.totalOrders}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-gray-500 text-sm">Ticket promedio</h3>
          <p className="text-2xl font-bold">${metrics.averageTicket.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-gray-500 text-sm">Tiempo promedio</h3>
          <p className="text-xl font-bold">Por orden: {metrics.averageServiceTime.toFixed(0)} min</p>
          <p className="text-xl font-bold">Por lote: {metrics.averageBatchTime.toFixed(0)} min</p>
        </div>
      </div>

      {/* Bloque único de productos más y menos vendidos */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Análisis de productos</h3>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Productos más vendidos */}
          <div>
            <h4 className="font-medium text-green-700 mb-2">Más vendidos</h4>
            {topProducts.length === 0 ? (
              <p className="text-gray-500 text-sm">No hay datos</p>
            ) : (
              <ul className="space-y-1">
                {topProducts.map((p) => (
                  <li key={`top-${p.category}-${p.name}`} className="flex justify-between text-sm border-b pb-1">
                    <span>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-gray-500 text-xs ml-1">({p.category})</span>
                    </span>
                    <span>
                      {p.quantity} uds - ${p.total.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Productos menos vendidos */}
          <div>
            <h4 className="font-medium text-red-700 mb-2">Menos vendidos</h4>
            {bottomProducts.length === 0 ? (
              <p className="text-gray-500 text-sm">No hay datos</p>
            ) : (
              <ul className="space-y-1">
                {bottomProducts.map((p) => (
                  <li key={`bottom-${p.category}-${p.name}`} className="flex justify-between text-sm border-b pb-1">
                    <span>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-gray-500 text-xs ml-1">({p.category})</span>
                    </span>
                    <span>
                      {p.quantity} uds - ${p.total.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-400 mt-2 text-center">
          El analisis completo se muestra en el reporte exportado en pdf, incluye produtos no vendidos
        </div>
      </div>

      {/* Tabla de órdenes */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Órdenes del período</h3>
          <button onClick={() => setShowOrdersTable(!showOrdersTable)} className="text-blue-500">
            {showOrdersTable ? 'Ocultar' : 'Mostrar'} detalles
          </button>
        </div>
        {showOrdersTable && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Cliente</th>
                  <th className="px-4 py-2 text-left">Mesa</th>
                  <th className="px-4 py-2 text-left">Creación</th>
                  <th className="px-4 py-2 text-left">Pago</th>
                  <th className="px-4 py-2 text-left">Total real</th>
                </tr>
              </thead>
              <tbody>
                {allOrders.map(order => (
                  <tr key={order.id} className="border-b">
                    <td className="px-4 py-2">{order.clientName}</td>
                    <td className="px-4 py-2">{order.tableNumber}</td>
                    <td className="px-4 py-2">{order.createdAt?.toDate().toLocaleString()}</td>
                    <td className="px-4 py-2">{getPaymentDate(order)?.toLocaleString() || '-'}</td>
                    <td className="px-4 py-2">${order.realTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminReports;
