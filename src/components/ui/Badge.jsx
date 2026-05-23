/**
 * Insignia para estados de productos/órdenes
 * @param {string} status - 'pending' | 'ready' | 'delivered' | 'cancelled'
 */
const statusStyles = {
  pending: 'bg-insignia-pendiente-fondo text-insignia-pendiente-texto',
  ready: 'bg-insignia-listo-fondo text-insignia-listo-texto',
  delivered: 'bg-insignia-entregado-fondo text-insignia-entregado-texto',
  cancelled: 'bg-insignia-cancelado-fondo text-insignia-cancelado-texto',
};

const labels = {
  pending: 'Pendiente',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export default function Badge({ status, className = '' }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[status] || ''} ${className}`}
    >
      {labels[status] || status}
    </span>
  );
}