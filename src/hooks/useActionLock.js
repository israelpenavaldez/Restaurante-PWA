import { useState, useCallback } from 'react';

/**
 * Hook personalizado para prevenir ejecuciones múltiples de una acción asíncrona.
 * Útil para evitar dobles envíos de formularios o múltiples clics en botones
 * que ejecutan operaciones en Firestore.
 *
 * @returns {Object} Objeto con dos propiedades:
 *   - `withLock`: función que envuelve una acción y la ejecuta solo si no hay otra en curso.
 *   - `isLocked`: booleano que indica si actualmente hay una acción bloqueada.
 */
export const useActionLock = () => {
  const [isLocked, setIsLocked] = useState(false);

  /**
   * Ejecuta una acción asíncrona con bloqueo.
   * Si ya hay una acción en curso (`isLocked === true`), la nueva llamada se ignora.
   * En caso de error, se puede pasar un callback `onError` para manejarlo;
   * de lo contrario, el error se registra en consola.
   *
   * @param {Function} action - Función asíncrona a ejecutar.
   * @param {Function} [onError] - Callback opcional para manejar errores.
   */
  const withLock = useCallback(async (action, onError) => {
    if (isLocked) return;
    setIsLocked(true);
    try {
      await action();
    } catch (error) {
      if (onError) {
        onError(error);
      } else {
        console.error(error);
      }
    } finally {
      setIsLocked(false);
    }
  }, [isLocked]);

  return { withLock, isLocked };
};