import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Vista de cierre de sesión.
 * Al montarse, ejecuta el cierre de sesión del usuario autenticado
 * y redirige automáticamente a la página de inicio de sesión.
 * Muestra una breve animación de "Cerrando sesión..." mientras se procesa.
 */
const SignOut = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  /**
   * Ejecuta el cierre de sesión al montar el componente.
   * Primero llama a la función `logout` del contexto de autenticación
   * y luego redirige al usuario a la página de login.
   */
  useEffect(() => {
    const doLogout = async () => {
      await logout();
      navigate('/login');
    };
    doLogout();
  }, [logout, navigate]);

  return (
    <div className="flex justify-center items-center min-h-screen bg-fondo">
      <div className="text-center">
        <p className="text-xl text-texto-claro font-body animate-pulse">
          Cerrando sesión...
        </p>
      </div>
    </div>
  );
};

export default SignOut;