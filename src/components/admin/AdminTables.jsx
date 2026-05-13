import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const AdminTables = () => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableDescription, setNewTableDescription] = useState('');
  const [editingTable, setEditingTable] = useState(null);
  const [editNumber, setEditNumber] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const fetchTables = async () => {
    const snapshot = await getDocs(collection(db, 'tables'));
    const tablesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    tablesData.sort((a, b) => a.number.toString().localeCompare(b.number.toString()));
    setTables(tablesData);
    setLoading(false);
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handleAddTable = async (e) => {
    e.preventDefault();
    if (!newTableNumber.trim()) {
      alert('El identificador de la mesa es obligatorio');
      return;
    }
    if (tables.some(t => t.number.toString() === newTableNumber.trim())) {
      alert('Ya existe una mesa con ese identificador');
      return;
    }
    await addDoc(collection(db, 'tables'), {
      number: newTableNumber.trim(),
      description: newTableDescription.trim(),
      status: 'free',
      occupiedSince: null,
      active: true,
    });
    setNewTableNumber('');
    setNewTableDescription('');
    fetchTables();
  };

  const handleUpdateTable = async (tableId) => {
    const table = tables.find(t => t.id === tableId);
    if (table.status === 'occupied') {
      alert('No se puede editar una mesa ocupada');
      return;
    }
    if (!editNumber.trim()) {
      alert('El identificador es obligatorio');
      return;
    }
    if (tables.some(t => t.id !== tableId && t.number.toString() === editNumber.trim())) {
      alert('Ya existe otra mesa con ese identificador');
      return;
    }
    await updateDoc(doc(db, 'tables', tableId), {
      number: editNumber.trim(),
      description: editDescription.trim(),
    });
    setEditingTable(null);
    fetchTables();
  };

  const handleToggleActive = async (tableId, currentActive) => {
    const table = tables.find(t => t.id === tableId);
    if (table.status === 'occupied') {
      alert('No se puede cambiar el estado de una mesa ocupada');
      return;
    }
    await updateDoc(doc(db, 'tables', tableId), { active: !currentActive });
    fetchTables();
  };

  const handleDeleteTable = async (tableId) => {
    const table = tables.find(t => t.id === tableId);
    if (table.status === 'occupied') {
      alert('No se puede eliminar una mesa ocupada');
      return;
    }
    if (window.confirm('¿Eliminar esta mesa permanentemente?')) {
      await deleteDoc(doc(db, 'tables', tableId));
      fetchTables();
    }
  };

  const startEdit = (table) => {
    if (table.status === 'occupied') {
      alert('No se puede editar una mesa ocupada');
      return;
    }
    setEditingTable(table.id);
    setEditNumber(table.number.toString());
    setEditDescription(table.description || '');
  };

  const cancelEdit = () => {
    setEditingTable(null);
    setEditNumber('');
    setEditDescription('');
  };

  if (loading) return <div className="text-center mt-10">Cargando mesas...</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Gestión de mesas</h2>

      {/* Formulario para agregar nueva mesa */}
      <form onSubmit={handleAddTable} className="bg-white rounded-lg shadow p-4 mb-6">
        <h3 className="text-lg font-semibold mb-4">Agregar nueva mesa</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            placeholder="Identificador (ej: 1, Terraza, VIP)"
            value={newTableNumber}
            onChange={(e) => setNewTableNumber(e.target.value)}
            className="p-2 border border-gray-300 rounded"
            required
          />
          <input
            type="text"
            placeholder="Descripción (ej: Entrada lado derecho)"
            value={newTableDescription}
            onChange={(e) => setNewTableDescription(e.target.value)}
            className="p-2 border border-gray-300 rounded"
          />
        </div>
        <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
          Agregar mesa
        </button>
      </form>

      {/* Lista de mesas existentes */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Identificador</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tables.map((table) => {
              const isOccupied = table.status === 'occupied';
              return (
                <tr key={table.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingTable === table.id ? (
                      <input
                        type="text"
                        value={editNumber}
                        onChange={(e) => setEditNumber(e.target.value)}
                        className="p-1 border border-gray-300 rounded"
                      />
                    ) : (
                      table.number
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingTable === table.id ? (
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="p-1 border border-gray-300 rounded w-full"
                      />
                    ) : (
                      table.description || '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      table.status === 'occupied' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {table.status === 'occupied' ? 'Ocupada' : 'Libre'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      table.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {table.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap space-x-2">
                    {editingTable === table.id ? (
                      <>
                        <button onClick={() => handleUpdateTable(table.id)} className="text-blue-500 hover:text-blue-700">
                          Guardar
                        </button>
                        <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700">
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(table)} className="text-blue-500 hover:text-blue-700">
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggleActive(table.id, table.active)}
                          disabled={isOccupied}
                          className={`text-sm px-2 py-1 rounded ${
                            table.active ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'
                          } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {table.active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          onClick={() => handleDeleteTable(table.id)}
                          disabled={isOccupied}
                          className="text-sm bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tables.length === 0 && (
        <p className="text-gray-500 text-center mt-8">No hay mesas registradas</p>
      )}
    </div>
  );
};

export default AdminTables;