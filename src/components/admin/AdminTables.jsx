import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { useNotification } from '../../context/NotificationContext';
import { db } from '../../firebase/config';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Toggle from '../ui/Toggle';

/**
 * Panel de gestión de mesas.
 * Permite al administrador visualizar todas las mesas registradas,
 * agregar nuevas, editar sus datos, activarlas/desactivarlas y eliminarlas.
 * Cada acción que modifica datos solicita confirmación previa.
 */
const AdminTables = () => {
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const { notify, confirm } = useNotification();

  // Estados para el modal de agregar mesa
  const [showAddModal, setShowAddModal] = useState(false);
  const [addNumber, setAddNumber] = useState('');
  const [addDesc, setAddDesc] = useState('');

  // Estados para el modal de editar mesa
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTableId, setEditingTableId] = useState(null);
  const [editNumber, setEditNumber] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Estados para el modal de detalles de mesa ocupada
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailTable, setDetailTable] = useState(null);
  const [detailOrders, setDetailOrders] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ===== CARGA DE MESAS =====
  const fetchTables = async () => {
    const snap = await getDocs(collection(db, 'tables'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => a.number.toString().localeCompare(b.number.toString()));
    setTables(data);
    setLoading(false);
  };

  useEffect(() => { fetchTables(); }, []);

  // ===== OPERACIONES CRUD =====

  /** Abre el modal para agregar una nueva mesa */
  const openAddModal = () => {
    setAddNumber('');
    setAddDesc('');
    setShowAddModal(true);
  };

  /** Cierra el modal de agregar */
  const closeAddModal = () => {
    setShowAddModal(false);
  };

  /** Guarda la nueva mesa en Firestore */
  const handleAddTable = async () => {
    if (!addNumber.trim()) {
      notify('Identificador obligatorio', 'warning');
      return;
    }
    if (tables.some(t => t.number.toString() === addNumber.trim())) {
      notify('Ya existe una mesa con ese identificador', 'error');
      return;
    }
    const ok = await confirm(`¿Agregar la mesa "${addNumber.trim()}"?`);
    if (!ok) return;
    await addDoc(collection(db, 'tables'), {
      number: addNumber.trim(),
      description: addDesc.trim(),
      status: 'free',
      occupiedSince: null,
      active: true
    });
    notify('Mesa agregada', 'success');
    closeAddModal();
    fetchTables();
  };

  /** Abre el modal de edición para una mesa existente */
  const openEditModal = (table) => {
    if (table.status === 'occupied') {
      notify('No se puede editar una mesa ocupada', 'warning');
      return;
    }
    setEditingTableId(table.id);
    setEditNumber(table.number.toString());
    setEditDesc(table.description || '');
    setShowEditModal(true);
  };

  /** Cierra el modal de edición */
  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingTableId(null);
    setEditNumber('');
    setEditDesc('');
  };

  /** Guarda los cambios de una mesa editada */
  const handleUpdateTable = async () => {
    if (!editNumber.trim()) {
      notify('Identificador obligatorio', 'warning');
      return;
    }
    if (tables.some(t => t.id !== editingTableId && t.number.toString() === editNumber.trim())) {
      notify('Ya existe otra mesa con ese identificador', 'error');
      return;
    }
    const ok = await confirm('¿Guardar los cambios en la mesa?');
    if (!ok) return;
    await updateDoc(doc(db, 'tables', editingTableId), {
      number: editNumber.trim(),
      description: editDesc.trim()
    });
    notify('Mesa actualizada', 'success');
    closeEditModal();
    fetchTables();
  };

  /** Elimina una mesa (con confirmación) */
  const deleteTable = async (id) => {
    const table = tables.find(t => t.id === id);
    if (table?.status === 'occupied') {
      notify('No se puede eliminar una mesa ocupada', 'warning');
      return;
    }
    const ok = await confirm('¿Eliminar esta mesa permanentemente?');
    if (!ok) return;
    await deleteDoc(doc(db, 'tables', id));
    // Si estábamos editando esa mesa, cerramos el modal
    if (editingTableId === id) closeEditModal();
    notify('Mesa eliminada', 'success');
    fetchTables();
  };

  /** Alterna el estado activo/inactivo de una mesa */
  const toggleActive = async (id, current) => {
    const ok = await confirm(current ? '¿Desactivar esta mesa?' : '¿Activar esta mesa?');
    if (!ok) return;
    await updateDoc(doc(db, 'tables', id), { active: !current });
    notify(current ? 'Mesa desactivada' : 'Mesa activada', 'success');
    fetchTables();
  };

  // ===== VER DETALLES DE MESA OCUPADA =====
  const openDetailModal = async (table) => {
    setDetailTable(table);
    setLoadingDetail(true);
    setShowDetailModal(true);
    try {
      const q = query(collection(db, 'orders'), where('tableNumber', '==', table.number));
      const snap = await getDocs(q);
      const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'paid');
      setDetailOrders(activeOrders);
    } catch (error) {
      console.error(error);
      notify('Error al cargar detalles', 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setDetailTable(null);
    setDetailOrders([]);
  };

  // ===== RENDERIZADO =====
  if (loading) return <div className="text-center mt-10 text-texto-claro">Cargando mesas...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-display font-bold text-texto">Gestión de mesas</h2>
        <Button 
          variant="primary" 
          onClick={openAddModal}
        >
          + Agregar mesa
        </Button>
      </div>

      {/* ===== CUADRÍCULA DE TARJETAS ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tables.map(table => (
          <Card key={table.id} className="flex flex-col gap-3">
            <div className="flex-1">
              <h3 className="text-xl font-display font-bold text-texto text-center">{table.number}</h3>
              {table.description && (
                <p className="text-sm text-texto-claro">{table.description}</p>
              )}
              <p className={`text-sm font-medium mt-2 text-right ${table.status === 'occupied' ? 'text-acento' : 'text-texto-exito'}`}>
                {table.status === 'occupied' ? 'Ocupada' : 'Libre'}
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-borde-claro">
              <Toggle
                enabled={table.active}
                onChange={() => toggleActive(table.id, table.active)}
                disabled={table.status === 'occupied'}
                label={table.active ? 'Activa' : 'Inactiva'}
              />

              <div className="flex gap-2">
                {table.status === 'occupied' ? (
                  <Button 
                    variant="primary" 
                    onClick={() => openDetailModal(table)} 
                    className="text-sm py-1"
                  >
                    Ver
                  </Button>
                ) : (
                  <>
                    <Button 
                      variant="warning" 
                      onClick={() => openEditModal(table)} 
                      className="text-sm py-1"
                    >
                      Editar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {tables.length === 0 && (
        <p className="text-texto-claro text-center mt-8">No hay mesas registradas</p>
      )}

      {/* ===== MODAL AGREGAR MESA ===== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-texto/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-tarjeta rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-borde-claro">
            <h3 className="text-lg font-display font-bold text-texto mb-4 text-center">Nueva mesa</h3>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Identificador</label>
                <input
                  type="text"
                  placeholder="Ej: 1, Terraza, VIP"
                  value={addNumber}
                  onChange={e => setAddNumber(e.target.value)}
                  className="w-full p-2 border-b-2 border-borde bg-white/80 rounded-t-md text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Descripción</label>
                <input
                  type="text"
                  placeholder="Opcional"
                  value={addDesc}
                  onChange={e => setAddDesc(e.target.value)}
                  className="w-full p-2 border-b-2 border-borde bg-white/80 rounded-t-md text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none transition"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="cancel" 
                onClick={closeAddModal}
              >
                Cancelar
              </Button>
              <Button 
                variant="success" 
                onClick={handleAddTable}
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL EDITAR MESA ===== */}
      {showEditModal && (
        <div className="fixed inset-0 bg-texto/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-tarjeta rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-borde-claro">
            <h3 className="text-lg font-display font-bold text-texto mb-4 text-center">Editar mesa</h3>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Identificador</label>
                <input
                  type="text"
                  value={editNumber}
                  onChange={e => setEditNumber(e.target.value)}
                  className="w-full p-2 border-b-2 border-borde bg-white/80 rounded-t-md text-texto focus:border-acento focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-texto mb-1">Descripción</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  className="w-full p-2 border-b-2 border-borde bg-white/80 rounded-t-md text-texto focus:border-acento focus:outline-none transition"
                />
              </div>
            </div>
            <div className="flex justify-between gap-2">
              <Button 
                variant="delete" 
                onClick={() => deleteTable(editingTableId)}
              >
                Eliminar mesa
              </Button>
              <div className="flex gap-2">
                <Button 
                  variant="success" 
                  onClick={handleUpdateTable}
                >
                  OK
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL DETALLES DE MESA OCUPADA ===== */}
      {showDetailModal && detailTable && (
        <div className="fixed inset-0 bg-texto/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-tarjeta rounded-2xl shadow-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-borde-claro">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-display font-bold text-texto">
                Mesa {detailTable.number} – {detailTable.description || ''}
              </h3>
              <Button 
                variant="cancel" 
                onClick={closeDetailModal} 
                className="text-sm"
              >
                Cerrar
              </Button>
            </div>
            {loadingDetail ? (
              <p className="text-center text-texto-claro">Cargando órdenes...</p>
            ) : detailOrders.length === 0 ? (
              <p className="text-center text-texto-claro">No hay órdenes activas para esta mesa.</p>
            ) : (
              detailOrders.map(order => (
                <div key={order.id} className="mb-4 border border-borde-claro rounded-xl p-3">
                  <p className="font-bold text-texto mb-2">{order.clientName}</p>
                  {order.batches?.map(batch => (
                    <div key={batch.batchId} className="mb-2 pl-2 border-l-2 border-borde">
                      <p className="text-xs text-texto-claro mb-1">
                        Lote #{batch.batchId} – {batch.timestamp?.toDate().toLocaleTimeString()}
                      </p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-texto-claro border-b border-borde-claro">
                            <th className="text-left py-1">Producto</th>
                            <th className="text-left py-1">Cant.</th>
                            <th className="text-left py-1">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batch.items.map(item => (
                            <tr key={item.id} className="border-b border-borde-claro/30">
                              <td className="py-1">
                                {item.name}
                                {item.notes && <span className="text-xs text-texto-claro ml-1">({item.notes})</span>}
                              </td>
                              <td className="py-1">{item.quantity}</td>
                              <td className="py-1">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  item.status === 'pending' ? 'bg-insignia-pendiente-fondo text-insignia-pendiente-texto' :
                                  item.status === 'ready' ? 'bg-insignia-listo-fondo text-insignia-listo-texto' :
                                  item.status === 'delivered' ? 'bg-insignia-entregado-fondo text-insignia-entregado-texto' :
                                  'bg-insignia-cancelado-fondo text-insignia-cancelado-texto'
                                }`}>
                                  {item.status === 'pending' ? 'Pendiente' :
                                   item.status === 'ready' ? 'Listo' :
                                   item.status === 'delivered' ? 'Entregado' : 'Cancelado'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTables;