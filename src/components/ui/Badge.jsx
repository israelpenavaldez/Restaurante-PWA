/**
 * Insignia para estados de productos/órdenes
 * @param {string} status - 'pending' | 'ready' | 'delivered' | 'cancelled'
 */
const statusStyles = {
  pending: 'bg-maiz-dorado/20 text-yellow-800',
  ready: 'bg-verde-nopal/20 text-green-800',
  delivered: 'bg-gray-200 text-gray-700',
  cancelled: 'bg-red-100 text-red-800',
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