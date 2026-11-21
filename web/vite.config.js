import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// While developing:
//   1. php -S localhost:8000 web/public/api/index.php   (the PHP API, from the project folder)
//   2. npm run dev                                       (React on http://localhost:5173)
// Vite forwards every /api/... request to PHP, so the browser sees ONE site.
// That's why login cookies just work and there are no CORS errors.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    // "npm run build" writes the finished site into public_html, ready to upload.
    // Everything in web/public (the PHP entry file, .htaccess, fonts) is copied too.
    outDir: '../public_html',
    emptyOutDir: true,
  },
});
