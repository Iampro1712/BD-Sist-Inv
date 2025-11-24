import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ErrorBoundary from './components/ErrorBoundary'
import router from './router'

// Create a client with optimized configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Tiempo que los datos se consideran frescos (no se refetch automáticamente)
      staleTime: 5 * 60 * 1000, // 5 minutos

      // Tiempo que los datos permanecen en caché después de no usarse
      gcTime: 10 * 60 * 1000, // 10 minutos (antes cacheTime)

      // No refetch automático al enfocar la ventana
      refetchOnWindowFocus: false,

      // Retry con exponential backoff
      retry: (failureCount, error) => {
        // No reintentar en errores 4xx (errores del cliente)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false
        }
        // Máximo 3 reintentos
        return failureCount < 3
      },

      // Delay entre reintentos con exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch en reconexión de red
      refetchOnReconnect: true,

      // Refetch al montar si los datos están stale
      refetchOnMount: true,
    },
    mutations: {
      // Retry para mutations
      retry: 1,
      retryDelay: 1000,
    },
  },
})

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
