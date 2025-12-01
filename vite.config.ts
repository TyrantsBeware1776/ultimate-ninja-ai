import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
        server: {
            port: 3000,
            host: '0.0.0.0',
            // 👇 ADD THIS LINE TO ALLOW ACCESS FROM THE REPLIT HOST
            allowedHosts: ['62f35eaf-4de3-465a-87f6-08854da0c0a8-00-3d4ycwijfb3yo.worf.replit.dev']
        },
        plugins: [react()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, '.'),
            }
        }
    };
});