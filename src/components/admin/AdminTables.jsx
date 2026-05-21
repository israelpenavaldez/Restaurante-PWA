import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useNotification } from '../../context/NotificationContext';
import { db } from '../../firebase/config';
import Card from '../ui/Card';
import Button from '../ui/Button';

const AdminTables = () => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNumber, setNewNumber] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editId, setEditId] = useState(null);
  const [editNumber, setEditNumber] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const { notify, confirm } = useNotification();

  const fetchTables = async () => {
    const snap = await getDocs(collection(db, 'tables'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => a.number.toString().localeCompare(b.number.toString()));
    setTables(data);
    setLoading(false);
  };

  useEffect(() => { fetchTables(); }, []);

  const addTable = async (e) => {
    e.preventDefault();
    if (!newNumber.trim()) return notify('Identificador obligatorio', 'warning');
    if (tables.some(t => t.number.toString() === newNumber.trim())) return notify('Ya existe', 'error');
    await addDoc(collection(db, 'tables'), { number: newNumber.trim(), description: newDesc.trim(), status: 'free', occupiedSince: null, active: true });
    setNewNumber(''); setNewDesc('');
    fetchTables();
  };

  const updateTable = async (id) => {
    if (!editNumber.trim()) return notify('Identificador obligatorio', 'warning');
    if (tables.some(t => t.id !== id && t.number.toString() === editNumber.trim())) return notify('Duplicado', 'error');
    await updateDoc(doc(db, 'tables', id), { number: editNumber.trim(), description: editDesc.trim() });
    setEditId(null);
    fetchTables();
  };

  const toggleActive = async (id, current) => {
    await updateDoc(doc(db, 'tables', id), { active: !current });
    fetchTables();
  };

  const deleteTable = async (id) => {
    const respuesta = await confirm('¿Eliminar esta mesa permanentemente?');
    if (!respuesta) return;
    await deleteDoc(doc(db, 'tables', id));
    notify('Mesa eliminada', 'success');
    fetchTables();
  };

  const startEdit = (t) => {
    if (t.status === 'occupied') return notify('Mesa ocupada', 'warning');
    setEditId(t.id);
    setEditNumber(t.number.toString());
    setEditDesc(t.description || '');
  };

  if (loading) return <div className="text-center mt-10 text-tierra-clara">Cargando mesas...</div>;

  return (
    <div>
      <h2 className="text-2xl font-display font-bold text-chocolate-oscuro mb-6">Gestión de mesas</h2>

      <Card className="mb-6">
        <h3 className="text-lg font-display font-bold text-chocolate-oscuro mb-4">Agregar nueva mesa</h3>
        <form onSubmit={addTable} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input type="text" placeholder="Identificador (ej: 1, Terraza, VIP)" value={newNumber}
            onChange={e => setNewNumber(e.target.value)}
            className="p-2 border-b-2 border-barro-claro bg-white/80 rounded-t-md text-chocolate-oscuro placeholder:text-tierra-clara focus:border-chile-guajillo focus:outline-none transition" />
          <input type="text" placeholder="Descripción" value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            className="p-2 border-b-2 border-barro-claro bg-white/80 rounded-t-md text-chocolate-oscuro placeholder:text-tierra-clara focus:border-chile-guajillo focus:outline-none transition" />
        </form>
        <Button variant="success" type="submit" onClick={addTable}>Agregar mesa</Button>
      </Card>

      <Card className="overflow-hidden !p-0">
        <table className="min-w-full divide-y divide-barro-claro/30">
          <thead className="bg-barro-claro/20">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-tierra-clara uppercase">Identificador</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-tierra-clara uppercase">Descripción</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-tierra-clara uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-tierra-clara uppercase">Activo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-tierra-clara uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-barro-claro/20 text-chocolate-oscuro">
            {tables.map(t => (
              <tr key={t.id}>
                <td className="px-6 py-4">{editId === t.id ? <input value={editNumber} onChange={e => setEditNumber(e.target.value)} className="p-1 border-b-2 border-barro-claro bg-transparent focus:border-chile-guajillo focus:outline-none" /> : t.number}</td>
                <td className="px-6 py-4">{editId === t.id ? <input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="p-1 border-b-2 border-barro-claro bg-transparent focus:border-chile-guajillo focus:outline-none w-full" /> : t.description || '-'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.status === 'occupied' ? 'bg-chile-guajillo/10 text-red-800' : 'bg-verde-nopal/20 text-green-800'}`}>
                    {t.status === 'occupied' ? 'Ocupada' : 'Libre'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.active ? 'bg-verde-nopal/20 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                    {t.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-6 py-4 space-x-2">
                  {editId === t.id ? (
                    <>
                      <button onClick={() => updateTable(t.id)} className="text-chile-guajillo font-medium text-sm">Guardar</button>
                      <button onClick={() => setEditId(null)} className="text-tierra-clara text-sm">Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(t)} className="text-chile-guajillo font-medium text-sm">Editar</button>
                      <button onClick={() => toggleActive(t.id, t.active)} className={`text-sm font-medium ${t.active ? 'text-maiz-dorado' : 'text-verde-nopal'}`}>
                        {t.active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button onClick={() => deleteTable(t.id)} className="text-chile-guajillo font-medium text-sm">Eliminar</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {tables.length === 0 && <p className="text-tierra-clara text-center mt-8">No hay mesas</p>}
    </div>
  );
};

export default AdminTables;