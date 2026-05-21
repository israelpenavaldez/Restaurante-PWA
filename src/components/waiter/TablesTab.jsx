import React, { useState, useEffect } from 'react';
import { subscribeToTables, subscribeToTableOrders } from '../../services/firestoreService';
import { formatElapsedTime } from '../../utils/helpers';
import Card from '../ui/Card';
import Button from '../ui/Button';

const TablesTab = ({ onOccupy, onView }) => {
  const [tables, setTables] = useState([]);
  const [readyCounts, setReadyCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToTables((tablesData) => {
      const activeTables = tablesData.filter(table => table.active !== false);
      activeTables.sort((a, b) => {
        const aNum = parseFloat(a.number);
        const bNum = parseFloat(b.number);
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        return String(a.number).localeCompare(String(b.number));
      });
      setTables(activeTables);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribes = [];
    tables.forEach(table => {
      if (table.status === 'occupied') {
        const unsubscribe = subscribeToTableOrders(table.number, (orders) => {
          let count = 0;
          orders.forEach(order => {
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

  if (loading) return <div className="text-center text-tierra-clara font-body mt-10">Cargando mesas...</div>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
      {tables.map((table) => (
        <Card key={table.id} className="border-l-4 border-chile-guajillo flex flex-col">
          <h3 className="text-2xl font-display font-bold text-chocolate-oscuro mb-2">
            Mesa {table.number}
          </h3>
          <p className={`mb-4 font-semibold ${table.status === 'occupied' ? 'text-chile-guajillo' : 'text-verde-nopal'}`}>
            {table.status === 'occupied' ? 'Ocupada' : 'Libre'}
          </p>

          {table.status === 'free' ? (
            <Button variant="primary" onClick={() => onOccupy(table.id)} className="w-full mt-auto">
              Ocupar
            </Button>
          ) : (
            <div className="mt-auto">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm text-tierra-clara">
                  Tiempo: {formatElapsedTime(table.occupiedSince)}
                </p>
                {readyCounts[table.id] > 0 && (
                  <span className="bg-verde-nopal text-white text-xs font-bold px-2 py-1 rounded-full">
                    {readyCounts[table.id]} listo{readyCounts[table.id] !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <Button variant="secondary" onClick={() => onView(table.id)} className="w-full">
                Ver
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};

export default TablesTab;