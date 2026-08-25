import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AuthProvider } from './context/AuthContext';
import { DialogoProvider } from './context/DialogoContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <DialogoProvider>
        <RouterProvider router={router} />
      </DialogoProvider>
    </AuthProvider>
  </React.StrictMode>,
);
