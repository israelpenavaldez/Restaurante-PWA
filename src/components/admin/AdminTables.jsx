import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useNotification } from '../../context/NotificationContext';
import { db } from '../../firebase/config';
import Card from '../ui/Card';
import Button from '../ui/Button';

/**
 * Panel de gestión de mesas.
 * Permite al administrador visualizar todas las mesas registradas,
 * agregar nuevas, editar sus datos, activarlas/desactivarlas y eliminarlas.
 * Cada acción que modifica datos solicita confirmación previa.
 */
const AdminTables = () => {
  // ===== ESTADOS =====
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  // Campos para el formulario de nueva mesa
  const [newNumber, setNewNumber] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Control de la mesa que se está editando en línea
  const [editId, setEditId] = useState(null);
  const [editNumber, setEditNumber] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const { notify, confirm } = useNotification();

  // ===== FUNCIONES DE DATOS =====

  /**
   * Obtiene todas las mesas de Firestore y las ordena
   * alfabéticamente por su identificador.
   */
  const fetchTables = async () => {
    const snap = await getDocs(collection(db, 'tables'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => a.number.toString().localeCompare(b.number.toString()));
    setTables(data);
    setLoading(false);
  };

  /** Carga inicial de mesas al montar el componente. */
  useEffect(() => { fetchTables(); }, []);

  // ===== OPERACIONES CRUD =====

  /**
   * Agrega una nueva mesa a Firestore.
   * Valida que el identificador no esté vacío ni duplicado,
   * y solicita confirmación antes de crear.
   */
  const addTable = async (e) => {
    e.preventDefault();
    if (!newNumber.trim()) return notify('Identificador obligatorio', 'warning');
    if (tables.some(t => t.number.toString() === newNumber.trim())) return notify('Ya existe', 'error');

    const ok = await confirm(`¿Agregar la mesa "${newNumber.trim()}"?`);
    if (!ok) return;

    await addDoc(collection(db, 'tables'), {
      number: newNumber.trim(),
      description: newDesc.trim(),
      status: 'free',
      occupiedSince: null,
      active: true
    });
    setNewNumber(''); setNewDesc('');
    notify('Mesa agregada', 'success');
    fetchTables();
  };

  /**
   * Guarda los cambios realizados sobre una mesa en edición.
   * @param {string} id - ID del documento de la mesa.
   */
  const updateTable = async (id) => {
    if (!editNumber.trim()) return notify('Identificador obligatorio', 'warning');
    if (tables.some(t => t.id !== id && t.number.toString() === editNumber.trim()))
      return notify('Duplicado', 'error');

    const ok = await confirm('¿Guardar los cambios en la mesa?');
    if (!ok) return;

    await updateDoc(doc(db, 'tables', id), {
      number: editNumber.trim(),
      description: editDesc.trim()
    });
    setEditId(null);
    notify('Mesa actualizada', 'success');
    fetchTables();
  };

  /**
   * Alterna el estado activo/inactivo de una mesa.
   * @param {string} id - ID del documento de la mesa.
   * @param {boolean} current - Estado actual (true = activa).
   */
  const toggleActive = async (id, current) => {
    const ok = await confirm(current ? '¿Desactivar esta mesa?' : '¿Activar esta mesa?');
    if (!ok) return;

    await updateDoc(doc(db, 'tables', id), { active: !current });
    notify(current ? 'Mesa desactivada' : 'Mesa activada', 'success');
    fetchTables();
  };

  /**
   * Elimina permanentemente una mesa de Firestore.
   * @param {string} id - ID del documento de la mesa.
   */
  const deleteTable = async (id) => {
    const ok = await confirm('¿Eliminar esta mesa permanentemente?');
    if (!ok) return;
    await deleteDoc(doc(db, 'tables', id));
    notify('Mesa eliminada', 'success');
    fetchTables();
  };

  /**
   * Activa el modo de edición en línea para una mesa.
   * No permite editar mesas que están ocupadas.
   * @param {Object} t - Objeto de la mesa a editar.
   */
  const startEdit = (t) => {
    if (t.status === 'occupied') return notify('Mesa ocupada', 'warning');
    setEditId(t.id);
    setEditNumber(t.number.toString());
    setEditDesc(t.description || '');
  };

  // ===== RENDERIZADO =====

  if (loading) return <div className="text-center mt-10 text-texto-claro">Cargando mesas...</div>;

  return (
    <div>
      <h2 className="text-2xl font-display font-bold text-texto mb-6">Gestión de mesas</h2>

      {/* ===== FORMULARIO: NUEVA MESA ===== */}
      <Card className="mb-6">
        <h3 className="text-lg font-display font-bold text-texto mb-4">Agregar nueva mesa</h3>
        <form onSubmit={addTable} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            placeholder="Identificador (ej: 1, Terraza, VIP)"
            value={newNumber}
            onChange={e => setNewNumber(e.target.value)}
            className="p-2 border-b-2 border-borde bg-white/80 rounded-t-md text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none transition"
          />
          <input
            type="text"
            placeholder="Descripción"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            className="p-2 border-b-2 border-borde bg-white/80 rounded-t-md text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none transition"
          />
        </form>
        <Button variant="success" type="submit" onClick={addTable}>Agregar mesa</Button>
      </Card>

      {/* ===== TABLA DE MESAS ===== */}
      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-borde-claro">
            <thead className="bg-tarjeta-alt/20">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-texto-claro uppercase whitespace-nowrap">Identificador</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-texto-claro uppercase whitespace-nowrap">Descripción</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-texto-claro uppercase whitespace-nowrap">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-texto-claro uppercase whitespace-nowrap">Activo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-texto-claro uppercase whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde-claro text-texto">
              {tables.map(t => (
                <tr key={t.id}>
                  {/* Columna editable en línea */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editId === t.id ? (
                      <input
                        value={editNumber}
                        onChange={e => setEditNumber(e.target.value)}
                        className="p-1 border-b-2 border-borde bg-transparent focus:border-acento focus:outline-none"
                      />
                    ) : (
                      t.number
                    )}
                  </td>
                  {/* Columna editable en línea */}
                  <td className="px-6 py-4">
                    {editId === t.id ? (
                      <input
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        className="p-1 border-b-2 border-borde bg-transparent focus:border-acento focus:outline-none w-full"
                      />
                    ) : (
                      t.description || '-'
                    )}
                  </td>
                  {/* Badge de estado (ocupada/libre) */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.status === 'occupied'
                          ? 'bg-insignia-cancelado-fondo text-insignia-cancelado-texto'
                          : 'bg-insignia-listo-fondo text-insignia-listo-texto'
                      }`}
                    >
                      {t.status === 'occupied' ? 'Ocupada' : 'Libre'}
                    </span>
                  </td>
                  {/* Badge de activo/inactivo */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.active
                          ? 'bg-insignia-listo-fondo text-insignia-listo-texto'
                          : 'bg-fondo-inactivo text-texto-claro'
                      }`}
                    >
                      {t.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {/* Botones de acción (en columna en móviles) */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col sm:flex-row gap-2">
                      {editId === t.id ? (
                        <>
                          <button onClick={() => updateTable(t.id)} className="text-acento font-medium text-sm">
                            Guardar
                          </button>
                          <button onClick={() => setEditId(null)} className="text-texto-claro text-sm">
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(t)} className="text-acento font-medium text-sm">
                            Editar
                          </button>
                          <button
                            onClick={() => toggleActive(t.id, t.active)}
                            className={`text-sm font-medium ${
                              t.active
                                ? 'text-texto-aviso hover:text-texto-aviso-hover'
                                : 'text-texto-exito hover:text-texto-exito-hover'
                            }`}
                          >
                            {t.active ? 'Desactivar' : 'Activar'}
                          </button>
                          <button onClick={() => deleteTable(t.id)} className="text-acento font-medium text-sm">
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mensaje cuando no hay mesas registradas */}
      {tables.length === 0 && <p className="text-texto-claro text-center mt-8">No hay mesas</p>}
    </div>
  );
};

export default AdminTables;