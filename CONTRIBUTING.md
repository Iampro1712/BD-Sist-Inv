# Guía de Contribución - Inventrix

¡Gracias por tu interés en contribuir a Inventrix! Esta guía te ayudará a comenzar.

## 📋 Tabla de Contenidos

- [Código de Conducta](#código-de-conducta)
- [Cómo Contribuir](#cómo-contribuir)
- [Configuración del Entorno](#configuración-del-entorno)
- [Estándares de Código](#estándares-de-código)
- [Proceso de Pull Request](#proceso-de-pull-request)
- [Reportar Bugs](#reportar-bugs)
- [Sugerir Mejoras](#sugerir-mejoras)

## Código de Conducta

Este proyecto se adhiere a un código de conducta. Al participar, se espera que mantengas este código.

## Cómo Contribuir

Hay muchas formas de contribuir a Inventrix:

- 🐛 Reportar bugs
- 💡 Sugerir nuevas características
- 📝 Mejorar la documentación
- 🔧 Enviar pull requests con correcciones o mejoras
- ✅ Escribir tests

## Configuración del Entorno

### 1. Fork y Clone

```bash
# Fork el repositorio en GitHub
# Luego clona tu fork
git clone https://github.com/tu-usuario/inventrix.git
cd inventrix
```

### 2. Configurar Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Editar .env con tus credenciales
python manage.py migrate
python manage.py runserver
```

### 3. Configurar Frontend

```bash
cd frontend
pnpm install
pnpm run dev
```

### 4. Crear una Rama

```bash
git checkout -b feature/mi-nueva-caracteristica
# o
git checkout -b fix/correccion-de-bug
```

## Estándares de Código

### Backend (Python/Django)

- Seguir [PEP 8](https://pep8.org/)
- Usar nombres descriptivos para variables y funciones
- Documentar funciones complejas con docstrings
- Mantener funciones pequeñas y enfocadas

**Ejemplo:**
```python
def calcular_total_orden(detalles):
    """
    Calcula el total de una orden sumando todos los detalles.
    
    Args:
        detalles (list): Lista de DetalleOrden
        
    Returns:
        Decimal: Total de la orden
    """
    return sum(detalle.subtotal for detalle in detalles)
```

### Frontend (React/JavaScript)

- Usar componentes funcionales con hooks
- Seguir convenciones de nombres:
  - Componentes: PascalCase (`ProductoCard.jsx`)
  - Hooks: camelCase con prefijo `use` (`useProductos.js`)
  - Utilidades: camelCase (`formatCurrency.js`)
- Usar PropTypes o TypeScript para validación
- Mantener componentes pequeños y reutilizables

**Ejemplo:**
```jsx
const ProductoCard = ({ producto, onEdit, onDelete }) => {
  return (
    <div className="card">
      <h3>{producto.nombre}</h3>
      <p>{producto.descripcion}</p>
      <div className="actions">
        <button onClick={() => onEdit(producto)}>Editar</button>
        <button onClick={() => onDelete(producto.id)}>Eliminar</button>
      </div>
    </div>
  )
}
```

### Estilos (TailwindCSS)

- Usar clases de Tailwind en lugar de CSS personalizado
- Mantener consistencia con el diseño existente
- Usar variables de color del tema (`primary`, `secondary`, etc.)

### Git Commits

Usar mensajes de commit descriptivos siguiendo [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: agregar filtro por categoría en productos
fix: corregir cálculo de stock en órdenes de venta
docs: actualizar README con instrucciones de Docker
style: formatear código según PEP 8
refactor: simplificar lógica de cálculo de totales
test: agregar tests para servicio de inventario
```

## Proceso de Pull Request

1. **Asegúrate de que tu código funciona**
   ```bash
   # Backend
   python manage.py test
   
   # Frontend
   pnpm run build
   ```

2. **Actualiza la documentación** si es necesario

3. **Crea el Pull Request**
   - Título descriptivo
   - Descripción detallada de los cambios
   - Referencias a issues relacionados

4. **Espera la revisión**
   - Responde a los comentarios
   - Realiza los cambios solicitados

### Template de Pull Request

```markdown
## Descripción
Breve descripción de los cambios realizados.

## Tipo de cambio
- [ ] Bug fix
- [ ] Nueva característica
- [ ] Breaking change
- [ ] Documentación

## ¿Cómo se ha probado?
Describe las pruebas realizadas.

## Checklist
- [ ] Mi código sigue los estándares del proyecto
- [ ] He realizado una auto-revisión de mi código
- [ ] He comentado mi código en áreas difíciles de entender
- [ ] He actualizado la documentación
- [ ] Mis cambios no generan nuevas advertencias
- [ ] He probado que mi fix/feature funciona correctamente
```

## Reportar Bugs

### Antes de Reportar

- Verifica que el bug no haya sido reportado antes
- Asegúrate de estar usando la última versión
- Recopila información sobre el bug

### Template de Bug Report

```markdown
## Descripción del Bug
Descripción clara y concisa del bug.

## Pasos para Reproducir
1. Ir a '...'
2. Hacer clic en '...'
3. Ver error

## Comportamiento Esperado
Qué esperabas que sucediera.

## Comportamiento Actual
Qué sucedió en realidad.

## Screenshots
Si aplica, agrega screenshots.

## Entorno
- OS: [ej. Windows 10]
- Navegador: [ej. Chrome 120]
- Versión: [ej. 1.0.0]

## Información Adicional
Cualquier otra información relevante.
```

## Sugerir Mejoras

### Template de Feature Request

```markdown
## Descripción de la Característica
Descripción clara de la característica propuesta.

## Problema que Resuelve
¿Qué problema resuelve esta característica?

## Solución Propuesta
Cómo debería funcionar la característica.

## Alternativas Consideradas
Otras soluciones que consideraste.

## Información Adicional
Mockups, ejemplos, etc.
```

## Estructura del Proyecto

### Backend

```
backend/
├── inventrix/          # Configuración del proyecto
│   ├── settings.py    # Configuración de Django
│   ├── urls.py        # URLs principales
│   └── wsgi.py        # WSGI application
├── api/               # API REST
│   ├── views.py       # ViewSets de la API
│   ├── serializers.py # Serializers
│   ├── services.py    # Lógica de negocio
│   ├── exceptions.py  # Excepciones personalizadas
│   └── middleware.py  # Middleware personalizado
└── inventory/         # App de inventario
    ├── models.py      # Modelos de datos
    └── admin.py       # Configuración del admin
```

### Frontend

```
frontend/src/
├── components/        # Componentes reutilizables
│   ├── ui/           # Componentes UI básicos
│   ├── forms/        # Componentes de formularios
│   ├── layout/       # Componentes de layout
│   └── [modulo]/     # Componentes específicos
├── pages/            # Páginas de la aplicación
├── hooks/            # Custom hooks
├── services/         # Servicios API
├── store/            # Estado global (Zustand)
├── utils/            # Utilidades
└── router/           # Configuración de rutas
```

## Testing

### Backend

```bash
# Ejecutar todos los tests
python manage.py test

# Ejecutar tests de una app específica
python manage.py test api

# Ejecutar con coverage
coverage run --source='.' manage.py test
coverage report
```

### Frontend

```bash
# Ejecutar tests (cuando estén implementados)
pnpm run test

# Ejecutar con coverage
pnpm run test:coverage
```

## Preguntas

Si tienes preguntas, puedes:
- Abrir un issue con la etiqueta `question`
- Contactar al equipo de desarrollo

## Licencia

Al contribuir a Inventrix, aceptas que tus contribuciones serán licenciadas bajo la misma licencia del proyecto.

---

¡Gracias por contribuir a Inventrix! 🚀
