import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

const buildTime = new Date().toISOString();

/** Publica um version.json com o carimbo do build — o app em execução
    compara com o próprio carimbo para detectar deploy mais novo. */
function emitVersionJson(): Plugin {
  return {
    name: 'emit-version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildTime }),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), emitVersionJson()],
  define: {
    // Carimbo de quando este build foi gerado (cada deploy = build novo)
    __BUILD_TIME__: JSON.stringify(buildTime),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
