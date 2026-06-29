import { useState, useEffect } from 'react';

/**
 * Hook personalizado para detectar el estado de conectividad a internet.
 * Devuelve `true` si el dispositivo está en línea, `false` si está desconectado.
 * Se actualiza automáticamente al cambiar el estado de la red.
 *
 * @returns {boolean} Estado actual de la conexión.
 */
export default function useOnlineStatus() {
  // Inicializa el estado con el valor actual de conexión del navegador
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    /** Marca el dispositivo como conectado. */
    const goOnline = () => setIsOnline(true);

    /** Marca el dispositivo como desconectado. */
    const goOffline = () => setIsOnline(false);

    // Escuchar los eventos de conexión/desconexión del navegador
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Limpiar los listeners al desmontar el componente
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}