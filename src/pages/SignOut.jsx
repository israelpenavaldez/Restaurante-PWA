import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SignOut = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

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