/**
 * Insignia para estados de productos y órdenes.
 * Muestra una etiqueta visual con el estado actual del elemento.
 *
 * @param {Object} props - Propiedades del componente.
 * @param {string} props.status - Estado del elemento: 'pending' | 'ready' | 'delivered' | 'cancelled'.
 * @param {string} [props.className=''] - Clases CSS adicionales para personalizar el estilo.
 */
export default function Badge({ status, className = '' }) {
  /** Mapeo de estilos visuales según el estado. */
  const statusStyles = {
    pending: 'bg-insignia-pendiente-fondo text-insignia-pendiente-texto',
    ready: 'bg-insignia-listo-fondo text-insignia-listo-texto',
    delivered: 'bg-insignia-entregado-fondo text-insignia-entregado-texto',
    cancelled: 'bg-insignia-cancelado-fondo text-insignia-cancelado-texto',
  };

  /** Etiquetas legibles para cada estado. */
  const labels = {
    pending: 'Pendiente',
    ready: 'Listo',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  };

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[status] || ''} ${className}`}
    >
      {labels[status] || status}
    </span>
  );
}