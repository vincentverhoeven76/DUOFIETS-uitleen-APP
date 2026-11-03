import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

// Virtuele plugin die optioneel lokale firebase-applet-config.json inlaadt indien aanwezig.
// Op GitHub (waar dit bestand in .gitignore staat) levert dit veilig een leeg object op
// zodat Rollup/Vite nooit faalt met UNRESOLVED_IMPORT.
function firebaseConfigPlugin(): Plugin {
  const virtualModuleId = 'virtual:firebase-config';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  return {
    name: 'firebase-config-plugin',
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    load(id) {
      if (id === resolvedVirtualModuleId) {
        const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
        if (fs.existsSync(configPath)) {
          try {
            const content = fs.readFileSync(configPath, 'utf-8');
            return `export default ${content};`;
          } catch {
            return `export default {};`;
          }
        }
        return `export default {};`;
      }
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), firebaseConfigPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
