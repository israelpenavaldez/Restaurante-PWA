import React, { useState, useEffect } from 'react';
import { subscribeToTables, subscribeToTableOrders } from '../../services/firestoreService';
import { formatElapsedTime } from '../../utils/helpers';
import Card from '../ui/Card';
import Button from '../ui/Button';

/**
 * Panel de mesas.
 * Muestra todas las mesas activas en formato de cuadrícula, indicando
 * el número, descripción, estado (libre/ocupada), tiempo de ocupación
 * y la cantidad de productos listos para entregar en cada mesa.
 * Permite atender una mesa libre o revisar una mesa ocupada.
 *
 * @param {Object} props - Propiedades del componente.
 * @param {Function} props.onOccupy - Función para atender una mesa libre.
 * @param {Function} props.onView - Función para revisar una mesa ocupada.
 */
const TablesTab = ({ onOccupy, onView }) => {
  const [tables, setTables] = useState([]);
  const [readyCounts, setReadyCounts] = useState({});
  const [loading, setLoading] = useState(true);

  /**
   * Se suscribe a todas las mesas en tiempo real.
   * Filtra solo las mesas activas y las ordena numéricamente.
   */
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

  /**
   * Para cada mesa ocupada, se suscribe a sus órdenes y cuenta
   * los productos que están en estado 'ready' (listos para entregar).
   * Los contadores se almacenan en `readyCounts` por ID de mesa.
   */
  useEffect(() => {
    const unsubscribes = [];
    tables.forEach(table => {
      if (table.status === 'occupied') {
        const unsubscribe = subscribeToTableOrders(table.number, (orders) => {
          let count = 0;
          orders.forEach(order => {
            // Solo contar productos de órdenes activas (no pagadas ni completadas)
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

  // Estado de carga inicial
  if (loading) return <div className="text-center text-texto-claro font-body mt-10">Cargando mesas...</div>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
      {tables.map((table) => (
        <Card key={table.id} className="border-l-4 border-acento flex flex-col">
          {/* Número de mesa */}
          <h3 className="text-2xl font-display font-bold text-texto mb-1">
            Mesa: {table.number}
          </h3>

          {/* Descripción de la mesa (si existe) */}
          {table.description && (
            <p className="text-sm text-texto-claro mb-2">{table.description}</p>
          )}

          {/* Estado de la mesa */}
          <p className={`mb-4 font-semibold ${table.status === 'occupied' ? 'text-acento' : 'text-texto-exito'}`}>
            {table.status === 'occupied' ? 'Ocupada' : 'Libre'}
          </p>

          {table.status === 'free' ? (
            /* Mesa libre: botón para atender */
            <Button variant="primary" onClick={() => onOccupy(table.id)} className="w-full mt-auto">
              Atender
            </Button>
          ) : (
            /* Mesa ocupada: información y botón para revisar */
            <div className="mt-auto">
              <div className="flex justify-between items-center mb-3">
                {/* Tiempo de ocupación */}
                <p className="text-sm text-texto-claro">
                  Tiempo: {formatElapsedTime(table.occupiedSince)}
                </p>

                {/* Contador de productos listos */}
                {readyCounts[table.id] > 0 && (
                  <span className="bg-insignia-listo-fondo text-insignia-listo-texto text-xs font-bold px-2 py-1 rounded-full">
                    {readyCounts[table.id]} listo{readyCounts[table.id] !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Botón para revisar la mesa */}
              <Button variant="secondary" onClick={() => onView(table.id)} className="w-full">
                Revisar
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};

export default TablesTab;