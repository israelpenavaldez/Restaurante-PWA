import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import Toast from '../components/ui/Toast';
import ConfirmModal from '../components/ui/ConfirmModal';
import PromptModal from '../components/ui/PromptModal';

// Contexto de notificaciones
const NotificationContext = createContext();

/** Hook personalizado para acceder a las funciones de notificación. */
export const useNotification = () => useContext(NotificationContext);

/**
 * Proveedor del sistema de notificaciones.
 * Proporciona tres tipos de interacción con el usuario:
 * - `notify`: muestra un mensaje temporal tipo toast en la esquina inferior derecha.
 * - `confirm`: abre un modal de confirmación (Sí/No) y devuelve una promesa con la respuesta.
 * - `prompt`: abre un modal con un campo de texto y devuelve una promesa con el valor ingresado.
 *
 * Los toasts se eliminan automáticamente después de 4 segundos.
 */
export const NotificationProvider = ({ children }) => {
  // Cola de toasts activos
  const [toasts, setToasts] = useState([]);

  // Estado del modal de confirmación
  const [confirmState, setConfirmState] = useState(null);
  const resolveRef = useRef(null); // referencia para resolver la promesa de confirmación

  // Estado del modal de entrada de texto
  const [promptState, setPromptState] = useState(null);
  const resolvePromptRef = useRef(null); // referencia para resolver la promesa del prompt

  // ===== FUNCIONES DE NOTIFICACIÓN =====

  /**
   * Muestra un mensaje toast temporal.
   *
   * @param {string} message - Texto del mensaje a mostrar.
   * @param {string} [type='success'] - Tipo de notificación: 'success' | 'error' | 'warning'.
   */
  const notify = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    // Eliminar automáticamente después de 4 segundos
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  /**
   * Muestra un modal de confirmación (Sí/No) y devuelve una promesa.
   * La promesa se resuelve con `true` si el usuario confirma, o `false` si cancela.
   *
   * @param {string} message - Mensaje descriptivo de la acción a confirmar.
   * @returns {Promise<boolean>} Promesa que se resuelve con la decisión del usuario.
   */
  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setConfirmState({ message });
    });
  }, []);

  /**
   * Resuelve la promesa del modal de confirmación.
   * @param {boolean} result - Resultado de la decisión (true = confirmado, false = cancelado).
   */
  const handleConfirmResponse = (result) => {
    if (resolveRef.current) {
      resolveRef.current(result);
      resolveRef.current = null;
    }
    setConfirmState(null);
  };

  /**
   * Muestra un modal de entrada de texto y devuelve una promesa.
   * La promesa se resuelve con el valor ingresado (string) o `null` si el usuario cancela.
   *
   * @param {string} message - Mensaje descriptivo de lo que se solicita.
   * @param {string} [defaultValue=''] - Valor inicial del campo de texto.
   * @returns {Promise<string|null>} Promesa que se resuelve con el valor ingresado o null.
   */
  const prompt = useCallback((message, defaultValue = '') => {
    return new Promise((resolve) => {
      resolvePromptRef.current = resolve;
      setPromptState({ message, defaultValue });
    });
  }, []);

  /**
   * Resuelve la promesa del modal de entrada de texto.
   * @param {string|null} value - Valor ingresado por el usuario (null si canceló).
   */
  const handlePromptResponse = (value) => {
    if (resolvePromptRef.current) {
      resolvePromptRef.current(value);
      resolvePromptRef.current = null;
    }
    setPromptState(null);
  };

  // ===== RENDERIZADO =====

  return (
    <NotificationContext.Provider value={{ notify, confirm, prompt }}>
      {children}

      {/* ===== TOASTS ===== */}
      <div className="fixed bottom-4 right-4 z-50 space-y-3">
        {toasts.map(toast => (
          <Toast key={toast.id} message={toast.message} type={toast.type} />
        ))}
      </div>

      {/* ===== MODAL DE CONFIRMACIÓN ===== */}
      {confirmState && (
        <ConfirmModal
          message={confirmState.message}
          onConfirm={() => handleConfirmResponse(true)}
          onCancel={() => handleConfirmResponse(false)}
        />
      )}

      {/* ===== MODAL DE ENTRADA DE TEXTO ===== */}
      {promptState && (
        <PromptModal
          message={promptState.message}
          defaultValue={promptState.defaultValue}
          onConfirm={(val) => handlePromptResponse(val)}
          onCancel={() => handlePromptResponse(null)}
        />
      )}
    </NotificationContext.Provider>
  );
};