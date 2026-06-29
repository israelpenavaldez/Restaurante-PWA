/**
 * Componente de notificación tipo "toast".
 * Muestra un mensaje temporal en la esquina inferior derecha de la pantalla
 * con estilos visuales que varían según el tipo de notificación.
 *
 * @param {Object} props - Propiedades del componente.
 * @param {string} props.message - Texto del mensaje a mostrar.
 * @param {string} [props.type='success'] - Tipo de notificación:
 *   'success' | 'error' | 'warning'.
 */
export default function Toast({ message, type = 'success' }) {
  /** Mapeo de tipos de notificación a clases de estilo. */
  const typeStyles = {
    success: 'bg-aviso-exito-fondo text-aviso-exito-texto',
    error: 'bg-aviso-error-fondo text-aviso-error-texto',
    warning: 'bg-aviso-alerta-fondo text-aviso-alerta-texto',
  };

  return (
    <div
      className={`px-5 py-3 rounded-2xl shadow-lg font-body text-sm flex items-center gap-2 animate-slide-in ${typeStyles[type] || typeStyles.success}`}
    >
      <span>{message}</span>
    </div>
  );
}