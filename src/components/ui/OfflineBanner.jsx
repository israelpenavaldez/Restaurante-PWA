import useOnlineStatus from '../../hooks/useOnlineStatus';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;
  return (
    <div className="bg-chile-guajillo text-white text-center py-2 text-sm font-medium">
      Sin conexión a internet – los cambios no se guardarán
    </div>
  );
}