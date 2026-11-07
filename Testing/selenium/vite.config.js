import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const fromHere = (path) => fileURLToPath(new URL(path, import.meta.url))

const mockSupabaseClient = fromHere('./mockSupabaseClient.js')
const mockAuthContext = fromHere('./mockAuthContext.jsx')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '../lib/supabaseClient', replacement: mockSupabaseClient },
      { find: './supabaseClient', replacement: mockSupabaseClient },
      { find: './context/AuthContext', replacement: mockAuthContext },
      { find: '../context/AuthContext', replacement: mockAuthContext },
    ],
  },
})