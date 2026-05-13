import { useAuth } from '../context/AuthContext';

export const usePermissions = () => {
  const { userData, isServiceOpen } = useAuth();

  // Verificar si el usuario es mesero activo y el servicio está abierto
  const checkWaiter = () => {
    if (!userData) throw new Error('Usuario no autenticado');
    if (userData.role !== 'waiter') throw new Error('Acción exclusiva para meseros');
    if (!userData.enabled) throw new Error('Tu cuenta está deshabilitada');
    if (!isServiceOpen) throw new Error('El restaurante está cerrado');
    return true;
  };

  // Verificar cocinero
  const checkChef = () => {
    if (!userData) throw new Error('Usuario no autenticado');
    if (userData.role !== 'chef') throw new Error('Acción exclusiva para cocineros');
    if (!userData.enabled) throw new Error('Tu cuenta está deshabilitada');
    // Nota: el servicio cerrado también afecta a cocineros (no pueden preparar)
    if (!isServiceOpen) throw new Error('El restaurante está cerrado');
    return true;
  };

  // Verificar administrador
  const checkAdmin = () => {
    if (!userData) throw new Error('Usuario no autenticado');
    if (userData.role !== 'admin') throw new Error('Acción exclusiva para administradores');
    if (!userData.enabled) throw new Error('Tu cuenta está deshabilitada');
    // Los admin pueden operar aunque el servicio esté cerrado (para abrirlo)
    return true;
  };

  return { checkWaiter, checkChef, checkAdmin };
};