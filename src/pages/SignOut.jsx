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
  return <div className="text-center mt-10">Cerrando sesión...</div>;
};

export default SignOut;