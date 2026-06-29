import { useAuth } from '../context/AuthContext';

/**
 * Hook personalizado para verificar permisos de usuario según su rol.
 * Proporciona funciones que lanzan un error descriptivo si el usuario
 * no cumple con los requisitos necesarios para ejecutar una acción.
 *
 * Todas las verificaciones comprueban:
 * - Que el usuario esté autenticado (userData existe).
 * - Que el rol coincida con el requerido.
 * - Que la cuenta esté habilitada (enabled === true).
 * - Que el servicio esté abierto (excepto para administradores, que pueden
 *   operar aunque el servicio esté cerrado para poder abrirlo).
 *
 * @returns {Object} Objeto con tres funciones de verificación:
 *   - `checkWaiter`: verifica permisos de mesero.
 *   - `checkChef`: verifica permisos de cocinero.
 *   - `checkAdmin`: verifica permisos de administrador.
 */
export const usePermissions = () => {
  const { userData, isServiceOpen } = useAuth();

  /**
   * Verifica que el usuario actual sea un mesero habilitado
   * y que el servicio esté abierto.
   *
   * @throws {Error} Si no se cumple alguna condición.
   * @returns {boolean} `true` si la verificación es exitosa.
   */
  const checkWaiter = () => {
    if (!userData) throw new Error('Usuario no autenticado');
    if (userData.role !== 'waiter') throw new Error('Acción exclusiva para meseros');
    if (!userData.enabled) throw new Error('Tu cuenta está deshabilitada');
    if (!isServiceOpen) throw new Error('El restaurante está cerrado');
    return true;
  };

  /**
   * Verifica que el usuario actual sea un cocinero habilitado
   * y que el servicio esté abierto.
   *
   * @throws {Error} Si no se cumple alguna condición.
   * @returns {boolean} `true` si la verificación es exitosa.
   */
  const checkChef = () => {
    if (!userData) throw new Error('Usuario no autenticado');
    if (userData.role !== 'chef') throw new Error('Acción exclusiva para cocineros');
    if (!userData.enabled) throw new Error('Tu cuenta está deshabilitada');
    // Los cocineros tampoco pueden operar con el servicio cerrado
    if (!isServiceOpen) throw new Error('El restaurante está cerrado');
    return true;
  };

  /**
   * Verifica que el usuario actual sea un administrador habilitado.
   * A diferencia de meseros y cocineros, el administrador puede operar
   * aunque el servicio esté cerrado (por ejemplo, para abrirlo de nuevo).
   *
   * @throws {Error} Si no se cumple alguna condición.
   * @returns {boolean} `true` si la verificación es exitosa.
   */
  const checkAdmin = () => {
    if (!userData) throw new Error('Usuario no autenticado');
    if (userData.role !== 'admin') throw new Error('Acción exclusiva para administradores');
    if (!userData.enabled) throw new Error('Tu cuenta está deshabilitada');
    // El admin puede operar aunque el servicio esté cerrado
    return true;
  };

  return { checkWaiter, checkChef, checkAdmin };
};