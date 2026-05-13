import React, { useState, useEffect } from 'react';
import { subscribeToTables, subscribeToTableOrders } from '../../services/firestoreService';

const TablesTab = ({ onOccupy, onView }) => {
  const [tables, setTables] = useState([]);
  const [readyCounts, setReadyCounts] = useState({});
  const [loading, setLoading] = useState(true);

  // Suscripción a mesas en tiempo real
  useEffect(() => {
    const unsubscribe = subscribeToTables((tablesData) => {
      // Filtrar mesas activas (active !== false)
      const activeTables = tablesData.filter(table => table.active !== false);
      // Ordenar por número (ascendente, o alfabético)
      activeTables.sort((a, b) => {
        // Si son números, comparar numéricamente; si son strings, alfabéticamente
        const aNum = parseFloat(a.number);
        const bNum = parseFloat(b.number);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum;
        }
        return String(a.number).localeCompare(String(b.number));
      });
      setTables(activeTables);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Para cada mesa ocupada, suscribirse a sus órdenes y contar productos listos (status 'ready')
  useEffect(() => {
    const unsubscribes = [];
    tables.forEach(table => {
      if (table.status === 'occupied') {
        const unsubscribe = subscribeToTableOrders(table.number, (orders) => {
          let count = 0;
          orders.forEach(order => {
            // Solo órdenes activas (no pagadas ni completadas)
            if (order.status !== 'paid' && order.status !== 'completed') {
              order.batches?.forEach(batch => {
                const readyItems = batch.items.filter(item => item.status === 'ready');
                count += readyItems.length;
              });
            }
          });
          setReadyCounts(prev => ({ ...prev, [table.id]: count }));
        });
        unsubscribes.push(unsubscribe);
      }
    });
    return () => unsubscribes.forEach(unsub => unsub());
  }, [tables]);

  const formatElapsedTime = (since) => {
    if (!since) return '';
    const diff = Math.floor((Date.now() - since.toDate()) / 1000);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) return <div className="text-center text-gray-500">Cargando mesas...</div>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {tables.map((table) => (
        <div key={table.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <h3 className="text-xl font-bold mb-2">Mesa {table.number}</h3>
          <p className={`mb-4 ${table.status === 'occupied' ? 'text-red-600' : 'text-green-600'}`}>
            {table.status === 'occupied' ? 'Ocupada' : 'Libre'}
          </p>
          {table.status === 'free' ? (
            <button
              onClick={() => onOccupy(table.id)}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full"
            >
              Ocupar
            </button>
          ) : (
            <>
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-gray-500">
                  Tiempo: {formatElapsedTime(table.occupiedSince)}
                </p>
                {readyCounts[table.id] > 0 && (
                  <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {readyCounts[table.id]} listo{readyCounts[table.id] !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <button
                onClick={() => onView(table.id)}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 w-full"
              >
                Ver
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

export default TablesTab;