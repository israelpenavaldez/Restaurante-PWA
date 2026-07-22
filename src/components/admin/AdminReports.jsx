import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getMenuCategories } from '../../services/firestoreService';
import { generateOrderPDF } from '../../utils/pdfHelpers';
import { getRealTotal, isOrderCompletelyCancelled } from '../../utils/helpers';
import Card from '../ui/Card';
import Button from '../ui/Button';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Panel de reportes de ventas.
 * Permite al administrador consultar métricas de ventas para un período
 * (día, semana o mes), ver el análisis de productos más y menos vendidos,
 * y exportar los resultados a Excel o PDF.
 */
const AdminReports = () => {
  // ===== ESTADOS DE FILTROS Y FECHAS =====
  const [filter, setFilter] = useState('day');            // 'day' | 'week' | 'month'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const weekNum = getWeekNumber(now);
    return `${year}-W${String(weekNum).padStart(2, '0')}`;
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // ===== ESTADOS DE DATOS =====
  const [allOrders, setAllOrders] = useState([]);
  const [validOrders, setValidOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalOrders: 0,
    averageTicket: 0,
    averageServiceTime: 0,
    averageBatchTime: 0
  });
  const [topProducts, setTopProducts] = useState([]);
  const [bottomProducts, setBottomProducts] = useState([]);
  const [productSortBy, setProductSortBy] = useState('quantity'); // 'quantity' | 'total'
  const [showOrdersTable, setShowOrdersTable] = useState(false);
  const [menuCategories, setMenuCategories] = useState([]);

  /**
   * Calcula el número de semana del año para una fecha dada.
   * @param {Date} d - Fecha de referencia.
   * @returns {number} Número de semana (1-53).
   */
  function getWeekNumber(d) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  }

  /**
   * Obtiene el rango de fechas (lunes a domingo) para una semana dada.
   * @param {number} year - Año.
   * @param {number} weekNumber - Número de semana.
   * @returns {{ monday: Date, sunday: Date }}
   */
  function getWeekRange(year, weekNumber) {
    const firstDay = new Date(year, 0, 1);
    const daysOffset = (firstDay.getDay() + 6) % 7;
    const firstMonday = new Date(year, 0, 1 + (daysOffset === 0 ? 0 : 7 - daysOffset));
    const monday = new Date(firstMonday);
    monday.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { monday, sunday };
  }

  // ===== EFECTOS =====

  /** Recalcula las fechas de inicio y fin cada vez que cambia el filtro o la selección. */
  useEffect(() => {
    let start, end;
    if (filter === 'day') {
      const [y, m, d] = selectedDate.split('-').map(Number);
      start = new Date(y, m - 1, d, 0, 0, 0, 0);
      end = new Date(y, m - 1, d, 23, 59, 59, 999);
    } else if (filter === 'week') {
      const [year, weekStr] = selectedWeek.split('-W');
      const { monday, sunday } = getWeekRange(parseInt(year), parseInt(weekStr));
      start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, 0);
      end = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 23, 59, 59, 999);
    } else {
      const [y, m] = selectedMonth.split('-');
      start = new Date(parseInt(y), parseInt(m) - 1, 1, 0, 0, 0, 0);
      end = new Date(parseInt(y), parseInt(m), 0, 23, 59, 59, 999);
    }
    setStartDate(start);
    setEndDate(end);
  }, [filter, selectedDate, selectedWeek, selectedMonth]);

  /** Obtiene las órdenes del período y calcula todas las métricas. */
  useEffect(() => {
    if (!startDate || !endDate) return;

    const fetchOrders = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'orders'),
          where('createdAt', '>=', Timestamp.fromDate(startDate)),
          where('createdAt', '<=', Timestamp.fromDate(endDate)),
          where('status', 'in', ['paid', 'completed'])
        );
        const snapshot = await getDocs(q);
        let ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        ordersData = ordersData.map(o => ({ ...o, realTotal: getRealTotal(o) }));
        const valid = ordersData.filter(o => !isOrderCompletelyCancelled(o));
        setAllOrders(ordersData);
        setValidOrders(valid);

        // Métricas de ventas y promedios
        const sales = valid.reduce((s, o) => s + o.realTotal, 0);
        const count = valid.length;
        const avgTicket = count > 0 ? sales / count : 0;

        // Cálculo de tiempos promedio de servicio y lote
        let totalAvgTime = 0, ordersWithTime = 0, totalBatchMin = 0, totalBatches = 0;
        valid.forEach(order => {
          let sumBatch = 0, bc = 0;
          order.batches?.forEach(batch => {
            if (batch.timestamp && batch.deliveredAt) {
              const mins = (batch.deliveredAt.toDate() - batch.timestamp.toDate()) / 60000;
              sumBatch += mins;
              bc++;
              totalBatchMin += mins;
              totalBatches++;
            }
          });
          if (bc > 0) { totalAvgTime += sumBatch / bc; ordersWithTime++; }
        });
        const avgService = ordersWithTime > 0 ? totalAvgTime / ordersWithTime : 0;
        const avgBatch = totalBatches > 0 ? totalBatchMin / totalBatches : 0;
        setMetrics({ totalSales: sales, totalOrders: count, averageTicket: avgTicket, averageServiceTime: avgService, averageBatchTime: avgBatch });

        // Agrupación de productos vendidos
        const prodMap = new Map();
        valid.forEach(order => {
          order.batches?.forEach(batch => {
            batch.items.forEach(item => {
              if (item.status !== 'cancelled') {
                const cat = item.category || 'General';
                const key = `${cat}::${item.name}`;
                if (!prodMap.has(key)) prodMap.set(key, { category: cat, name: item.name, quantity: 0, total: 0 });
                const p = prodMap.get(key);
                p.quantity += item.quantity;
                p.total += item.price * item.quantity;
              }
            });
          });
        });
        const sorted = Array.from(prodMap.values()).sort((a, b) =>
          productSortBy === 'quantity' ? b.quantity - a.quantity : b.total - a.total
        );
        setTopProducts(sorted.slice(0, 5));
        setBottomProducts([...sorted].sort((a, b) =>
          productSortBy === 'quantity' ? a.quantity - b.quantity : a.total - b.total
        ).slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [startDate, endDate, filter, productSortBy]);

  /** Carga las categorías del menú para usarlas en la descarga de cuentas individuales. */
  useEffect(() => {
    const loadCategories = async () => {
      const cats = await getMenuCategories();
      setMenuCategories(cats);
    };
    loadCategories();
  }, []);

  // ===== EXPORTACIONES =====

  /** Exporta los datos de las órdenes del período a un archivo Excel. */
  const exportToExcel = () => {
    const data = allOrders.map(o => ({
      Cliente: o.clientName,
      Mesa: o.tableNumber,
      'Fecha creación': o.createdAt?.toDate().toLocaleString(),
      'Fecha pago': o.completedAt?.toDate()?.toLocaleString() || '',
      'Total real': o.realTotal,
      Estado: o.status
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, `reporte_${filter}_${startDate?.toISOString().slice(0, 10)}.xlsx`);
  };

  /** Exporta un informe completo en PDF con métricas, productos vendidos y no vendidos. */
  const exportToPDF = async () => {
    // Obtener todos los productos del menú para identificar los no vendidos
    const menuSnap = await getDocs(collection(db, 'menuCategories'));
    const allMenu = [];
    menuSnap.forEach(doc => {
      const cat = doc.data().name;
      (doc.data().items || []).forEach(i => allMenu.push({ category: cat, name: i.name }));
    });

    // Productos vendidos en el período
    const soldMap = new Map();
    validOrders.forEach(o => {
      o.batches?.forEach(b => {
        b.items.forEach(i => {
          if (i.status !== 'cancelled') {
            const key = `${i.category || 'General'}::${i.name}`;
            if (!soldMap.has(key)) soldMap.set(key, { category: i.category || 'General', name: i.name, quantity: 0, total: 0 });
            const p = soldMap.get(key);
            p.quantity += i.quantity;
            p.total += i.price * i.quantity;
          }
        });
      });
    });
    const sold = Array.from(soldMap.values()).sort((a, b) => b.quantity - a.quantity);
    const unsold = allMenu.filter(mi => !soldMap.has(`${mi.category}::${mi.name}`));

    // Construcción del PDF
    const doc = new jsPDF();
    doc.text(`Reporte - ${filter.toUpperCase()}`, 14, 10);
    doc.text(`Período: ${startDate?.toLocaleDateString()} - ${endDate?.toLocaleDateString()}`, 14, 20);
    doc.text(`Ventas: $${metrics.totalSales.toFixed(2)}`, 14, 30);
    doc.text(`Órdenes: ${metrics.totalOrders}`, 14, 40);
    doc.text(`Ticket promedio: $${metrics.averageTicket.toFixed(2)}`, 14, 50);
    doc.text(`Tiempo promedio orden: ${metrics.averageServiceTime.toFixed(0)} min`, 14, 60);
    doc.text(`Tiempo promedio lote: ${metrics.averageBatchTime.toFixed(0)} min`, 14, 70);

    // Tabla de órdenes
    let y = 80;
    autoTable(doc, {
      startY: y,
      head: [['Cliente', 'Mesa', 'Creación', 'Pago', 'Total real']],
      body: allOrders.map(o => [
        o.clientName,
        o.tableNumber,
        o.createdAt?.toDate().toLocaleString(),
        o.completedAt?.toDate()?.toLocaleString() || '',
        `$${o.realTotal}`
      ])
    });
    y = doc.lastAutoTable.finalY + 10;

    // Productos vendidos
    doc.text('Productos vendidos', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Categoría', 'Producto', 'Unidades', 'Total']],
      body: sold.map(p => [p.category, p.name, p.quantity, `$${p.total.toFixed(2)}`])
    });
    y = doc.lastAutoTable.finalY + 10;

    // Productos no vendidos
    if (unsold.length) {
      doc.text('No vendidos', 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [['Categoría', 'Producto']],
        body: unsold.map(p => [p.category, p.name])
      });
    }

    doc.save(`reporte_${filter}_${startDate?.toISOString().slice(0, 10)}.pdf`);
  };

  // ===== RENDERIZADO =====

  if (loading) return <div className="text-center mt-10 text-texto-claro">Cargando reportes...</div>;

  return (
    <div>
      {/* ===== CABECERA CON BOTONES DE EXPORTACIÓN ===== */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-display font-bold text-texto">Reportes de ventas</h2>
      </div>

      {/* ===== FILTROS DE PERÍODO ===== */}
      <Card className="mb-6 text-center">
        <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
          {/* Botones de período */}
          <div className="flex gap-1">
            {['day', 'week', 'month'].map(opt => (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  filter === opt
                    ? 'bg-acento text-texto-inverso'
                    : 'bg-tarjeta-alt/30 text-texto hover:bg-tarjeta-alt/50'
                }`}
              >
                {opt === 'day' ? 'Día' : opt === 'week' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>

          {/* Selector de fecha */}
          <div>
            {filter === 'day' && (
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="p-2 border-b-2 border-borde bg-white/80 rounded-t-md text-texto focus:border-acento focus:outline-none transition" />
            )}
            {filter === 'week' && (
              <input type="week" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}
                className="p-2 border-b-2 border-borde bg-white/80 rounded-t-md text-texto focus:border-acento focus:outline-none transition" />
            )}
            {filter === 'month' && (
              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                className="p-2 border-b-2 border-borde bg-white/80 rounded-t-md text-texto focus:border-acento focus:outline-none transition" />
            )}
          </div>
        </div>

        {/* Texto del período seleccionado */}
        <p className="text-sm text-texto-claro mt-3">
          Período: {startDate?.toLocaleDateString()} - {endDate?.toLocaleDateString()}
        </p>
      </Card>

      {/* ===== TARJETAS DE MÉTRICAS PRINCIPALES ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="text-center">
          <h3 className="text-texto-claro text-sm uppercase tracking-wide">Ventas totales</h3>
          <p className="text-2xl font-display font-bold text-acento">${metrics.totalSales.toFixed(2)}</p>
        </Card>
        <Card className="text-center">
          <h3 className="text-texto-claro text-sm uppercase tracking-wide">Órdenes</h3>
          <p className="text-2xl font-display font-bold text-texto">{metrics.totalOrders}</p>
        </Card>
        <Card className="text-center">
          <h3 className="text-texto-claro text-sm uppercase tracking-wide">Ticket promedio</h3>
          <p className="text-2xl font-display font-bold text-texto">${metrics.averageTicket.toFixed(2)}</p>
        </Card>
        <Card className="text-center">
          <h3 className="text-texto-claro text-sm uppercase tracking-wide">Tiempo promedio</h3>
          <p className="text-lg text-texto">Orden: {metrics.averageServiceTime.toFixed(0)} min</p>
          <p className="text-lg text-texto">Lote: {metrics.averageBatchTime.toFixed(0)} min</p>
        </Card>
      </div>

      {/* ===== ANÁLISIS DE PRODUCTOS ===== */}
      <Card className="mb-6">
        <div className="flex flex-col justify-between items-center mb-4">
          <h3 className="text-lg font-display font-bold text-texto">Análisis de productos</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-texto-claro">Ordenar por:</span>
            <select
              value={productSortBy}
              onChange={e => setProductSortBy(e.target.value)}
              className="p-1 border-b-2 border-borde bg-transparent text-texto text-sm focus:border-acento focus:outline-none"
            >
              <option value="quantity">Cantidad</option>
              <option value="total">Monto</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Más vendidos */}
          <div>
            <h4 className="font-medium text-texto-exito mb-2">Más vendidos</h4>
            {topProducts.length === 0 ? (
              <p className="text-texto-claro text-sm">No hay datos</p>
            ) : (
              <ul className="space-y-1">
                {topProducts.map(p => (
                  <li key={`top-${p.category}-${p.name}`} className="flex justify-between text-sm border-b border-borde-claro pb-1">
                    <span className="text-texto">{p.name} <span className="text-texto-claro text-xs">({p.category})</span></span>
                    <span className="text-texto">{p.quantity} uds - ${p.total.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Menos vendidos */}
          <div>
            <h4 className="font-medium text-acento mb-2">Menos vendidos</h4>
            {bottomProducts.length === 0 ? (
              <p className="text-texto-claro text-sm">No hay datos</p>
            ) : (
              <ul className="space-y-1">
                {bottomProducts.map(p => (
                  <li key={`bottom-${p.category}-${p.name}`} className="flex justify-between text-sm border-b border-borde-claro pb-1">
                    <span className="text-texto">{p.name} <span className="text-texto-claro text-xs">({p.category})</span></span>
                    <span className="text-texto">{p.quantity} uds - ${p.total.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-4 mb-6">
       <Button 
          variant="primary" 
          onClick={exportToExcel}
        >
          Exportar Excel
        </Button>
        <Button 
          variant="primary" 
          onClick={exportToPDF}
        >
          Exportar PDF
        </Button>
      </div>

      {/* ===== TABLA DE ÓRDENES DEL PERÍODO ===== */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-display font-bold text-texto">Órdenes del período</h3>
          <button
            onClick={() => setShowOrdersTable(!showOrdersTable)}
            className="text-acento hover:text-acento-hover font-medium text-sm transition"
          >
            {showOrdersTable ? 'Ocultar' : 'Mostrar'} detalles
          </button>
        </div>
        {showOrdersTable && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-borde-claro">
              <thead>
                <tr className="text-texto">
                  <th className="px-4 py-2 text-left">Cliente</th>
                  <th className="px-4 py-2 text-left">Mesa</th>
                  <th className="px-4 py-2 text-left">Creación</th>
                  <th className="px-4 py-2 text-left">Pago</th>
                  <th className="px-4 py-2 text-left">Total real</th>
                  <th className="px-4 py-2 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {allOrders.map(o => (
                  <tr key={o.id} className="border-b border-borde-claro text-texto">
                    <td className="px-4 py-2">{o.clientName}</td>
                    <td className="px-4 py-2">{o.tableNumber}</td>
                    <td className="px-4 py-2">{o.createdAt?.toDate().toLocaleString()}</td>
                    <td className="px-4 py-2">{o.completedAt?.toDate()?.toLocaleString() || '-'}</td>
                    <td className="px-4 py-2">${o.realTotal}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => generateOrderPDF(o, menuCategories, 'final')}
                        className="text-acento hover:text-acento-hover font-medium text-sm transition"
                      >
                        Descargar cuenta
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminReports;