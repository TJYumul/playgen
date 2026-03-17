import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './app';
import { AuthProvider } from './components/AuthProvider';
import { BrowserRouter } from 'react-router-dom'; 

function Root() {
  useEffect(() => {
    // Align with the app's dark UI. This enables the design tokens in `index.css` under `.dark`.
    document.documentElement.classList.add('dark')
  }, [])

  return (
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
)