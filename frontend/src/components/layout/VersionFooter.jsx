/**
 * Pie de página con la versión del sistema.
 *
 * Existe para poder responder "¿qué versión estás usando?" sin adivinar. Cuando
 * alguien reporta que algo no funciona, lo primero que hace falta saber es si
 * está viendo el despliegue nuevo o una pestaña vieja en caché — y hasta ahora
 * no había forma de saberlo desde la interfaz.
 *
 * `__APP_VERSION__` lo inyecta Vite desde package.json (ver vite.config.js), así
 * que no hay un número escrito a mano que se pueda quedar viejo.
 */
const VersionFooter = () => (
  <footer className="border-t border-gray-200 dark:border-gray-800 mt-8">
    <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
      <span className="font-medium text-gray-500 dark:text-gray-400">Inventrix</span>
      <span aria-hidden="true">·</span>
      {/* `title` para poder copiarla al reportar un problema. */}
      <span className="font-mono" title={`Versión ${__APP_VERSION__}`}>
        v{__APP_VERSION__}
      </span>
      <span aria-hidden="true">·</span>
      <span>JC Motoshop</span>
    </div>
  </footer>
)

export default VersionFooter
