import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { collection, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Card from '../ui/Card';
import Button from '../ui/Button';

/**
 * Panel de gestión de empleados.
 * Permite al administrador visualizar la lista de usuarios registrados,
 * cambiar su rol, habilitarlos/deshabilitarlos y eliminarlos.
 * La mayoría de las acciones están bloqueadas mientras el servicio está abierto.
 */
const AdminEmployees = () => {
  const { user, isServiceOpen } = useAuth();
  const { notify, confirm } = useNotification();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employeeToEdit, setEmployeeToEdit] = useState(null); // empleado cuyo rol se va a cambiar en el modal

  /**
   * Carga la lista de empleados desde Firestore.
   * Excluye al administrador actual para que no se pueda modificar a sí mismo.
   */
  useEffect(() => {
    const fetchEmployees = async () => {
      const snap = await getDocs(collection(db, 'users'));
      const list = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (data.email !== user.email) list.push({ id: doc.id, ...data });
      });
      setEmployees(list);
      setLoading(false);
    };
    fetchEmployees();
  }, [user.email]);

  /**
   * Actualiza el rol de un empleado en Firestore.
   * @param {string} id - ID del documento del usuario.
   * @param {string} newRole - Nuevo rol ('waiter' o 'chef').
   */
  const updateRole = async (id, newRole) => {
    try {
      await updateDoc(doc(db, 'users', id), { role: newRole });
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, role: newRole } : e));
      setEmployeeToEdit(null);
      notify('Rol actualizado correctamente', 'success');
    } catch (error) {
      console.error(error);
      notify('No se pudo actualizar el rol', 'error');
    }
  };

  /**
   * Alterna el estado habilitado/deshabilitado de un empleado.
   * Solicita confirmación antes de proceder.
   * @param {string} id - ID del documento del usuario.
   * @param {boolean} current - Estado actual del empleado.
   */
  const toggleStatus = async (id, current) => {
    const ok = await confirm(current ? '¿Deshabilitar este empleado?' : '¿Habilitar este empleado?');
    if (!ok) return;
    try {
      await updateDoc(doc(db, 'users', id), { enabled: !current });
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, enabled: !current } : e));
      notify(current ? 'Empleado deshabilitado' : 'Empleado habilitado', 'success');
    } catch (error) {
      console.error(error);
      notify('No se pudo cambiar el estado', 'error');
    }
  };

  /**
   * Elimina permanentemente a un empleado de Firestore.
   * Solicita confirmación antes de proceder.
   * @param {string} id - ID del documento del usuario.
   */
  const deleteEmp = async (id) => {
    const respuesta = await confirm('¿Eliminar este empleado? Se perderán sus datos.');
    if (!respuesta) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      setEmployees(prev => prev.filter(e => e.id !== id));
      notify('Empleado eliminado', 'success');
    } catch (error) {
      console.error(error);
      notify('No se pudo eliminar el empleado', 'error');
    }
  };

  // Estado de carga inicial
  if (loading) return <div className="text-center mt-10 text-texto-claro">Cargando empleados...</div>;

  return (
    <div>
      <h2 className="text-2xl font-display font-bold text-texto mb-6">Gestión de empleados</h2>

      {/* Aviso cuando el servicio está abierto: las acciones están bloqueadas */}
      {isServiceOpen && (
        <div className="mb-4 text-center text-acento bg-acento/10 px-4 py-2 rounded-full text-sm">
          Cierre el servicio para gestionar empleados
        </div>
      )}

      {/* Tabla de empleados con scroll horizontal en pantallas pequeñas */}
      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-borde-claro">
            <thead className="bg-tarjeta-alt/20">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-texto-claro uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-texto-claro uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-texto-claro uppercase tracking-wider">Rol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-texto-claro uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-texto-claro uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde-claro">
              {employees.map(emp => (
                <tr key={emp.id} className="text-texto">
                  <td className="px-6 py-4 whitespace-nowrap">{emp.displayName || 'Sin nombre'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{emp.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="capitalize">
                      {emp.role === 'waiter' ? 'Mesero' : emp.role === 'chef' ? 'Cocinero' : emp.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {/* Insignia de estado (activo/inactivo) */}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      emp.enabled ? 'bg-insignia-listo-fondo text-insignia-listo-texto' : 'bg-insignia-cancelado-fondo text-insignia-cancelado-texto'
                    }`}>
                      {emp.enabled ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {/* Botones de acción (deshabilitados si el servicio está abierto) */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => setEmployeeToEdit(emp)}
                        disabled={isServiceOpen}
                        className="text-acento hover:text-acento-hover text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Editar rol
                      </button>
                      <button
                        onClick={() => toggleStatus(emp.id, emp.enabled)}
                        disabled={isServiceOpen}
                        className={`text-sm font-medium ${emp.enabled ? 'text-texto-aviso hover:text-texto-aviso-hover' : 'text-texto-exito hover:text-texto-exito-hover'} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {emp.enabled ? 'Deshabilitar' : 'Habilitar'}
                      </button>
                      <button
                        onClick={() => deleteEmp(emp.id)}
                        disabled={isServiceOpen}
                        className="text-acento hover:text-acento-hover text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mensaje si no hay empleados */}
      {employees.length === 0 && (
        <p className="text-texto-claro text-center mt-8">No hay empleados registrados</p>
      )}

      {/* Modal para seleccionar el nuevo rol del empleado */}
      {employeeToEdit && (
        <div className="fixed inset-0 bg-texto/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-tarjeta rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-borde-claro">
            <p className="text-texto text-lg mb-6 text-center">
              Selecciona el nuevo rol para <strong>{employeeToEdit.displayName || employeeToEdit.email}</strong>:
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="warning" onClick={() => updateRole(employeeToEdit.id, 'waiter')}>
                Mesero
              </Button>
              <Button variant="warning" onClick={() => updateRole(employeeToEdit.id, 'chef')}>
                Cocinero
              </Button>
              <Button variant="primary" onClick={() => setEmployeeToEdit(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEmployees;