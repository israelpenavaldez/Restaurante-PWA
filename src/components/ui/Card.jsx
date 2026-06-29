/**
 * Tarjeta contenedora reutilizable.
 * Proporciona un fondo blanco (bg-tarjeta), bordes redondeados,
 * sombra suave y un borde claro decorativo.
 *
 * @param {Object} props - Propiedades del componente.
 * @param {React.ReactNode} props.children - Contenido de la tarjeta.
 * @param {string} [props.className=''] - Clases CSS adicionales.
 * @param {Object} [props...] - Resto de propiedades estándar de un <div>.
 */
export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-tarjeta rounded-2xl shadow-md border border-borde-claro/20 p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}