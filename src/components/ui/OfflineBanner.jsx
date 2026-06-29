import useOnlineStatus from '../../hooks/useOnlineStatus';

/**
 * Banner de advertencia que se muestra cuando el dispositivo pierde la conexión a internet.
 * Utiliza el hook `useOnlineStatus` para detectar el estado de conectividad en tiempo real.
 * Si el dispositivo está en línea, el banner se oculta automáticamente.
 */
export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  // No mostrar el banner si hay conexión
  if (isOnline) return null;

  return (
    <div className="bg-fondo-desconectado text-texto-desconectado text-center py-2 text-sm font-medium">
      Sin conexión a internet – los cambios no se guardarán
    </div>
  );
}