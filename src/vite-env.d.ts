/// <reference types="vite/client" />

declare module 'virtual:firebase-config' {
  const config: Record<string, string>;
  export default config;
}
