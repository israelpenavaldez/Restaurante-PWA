/**
 * Tarjeta base con estilo "Cocina de raíz"
 * Fondo hueso, sombra suave y borde redondeado
 */
export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-hueso rounded-2xl shadow-md border border-barro-claro/20 p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}