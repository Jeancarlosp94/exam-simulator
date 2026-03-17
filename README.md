# Simulador de Exámenes CACES

Aplicación web de una sola página (SPA) para simular exámenes médicos tipo CACES, desarrollada con React y Tailwind CSS.

## 🚀 Características

- ✅ Carga de banco de preguntas desde archivo JSON local
- ⚙️ Configuración flexible del examen (modo CACES completo, práctica o personalizado)
- ⏱️ Cronómetro en cuenta regresiva
- 📝 Navegación entre preguntas con panel lateral/modal
- 🏷️ Marcado de preguntas para revisión
- 📊 Pantalla de resultados con estadísticas detalladas
- 💡 Explicaciones de respuestas incorrectas
- 📱 Diseño responsivo para móvil y desktop

## 📦 Instalación

```bash
# Clonar o copiar la carpeta del proyecto
cd exam-simulator

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El proyecto estará disponible en `http://localhost:5173`

## 🏗️ Estructura del Proyecto

```
exam-simulator/
├── src/
│   ├── components/
│   │   ├── FileUpload.jsx      # Carga de archivo JSON
│   │   ├── ExamConfig.jsx      # Configuración del examen
│   │   ├── ExamSimulator.jsx   # Simulador principal
│   │   ├── Timer.jsx            # Cronómetro
│   │   ├── QuestionCard.jsx    # Tarjeta de pregunta
│   │   ├── QuestionGrid.jsx    # Panel de navegación
│   │   └── Results.jsx          # Pantalla de resultados
│   ├── App.jsx                  # Componente principal
│   ├── main.jsx                 # Punto de entrada
│   └── index.css                # Estilos Tailwind
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## 📄 Formato del JSON

El archivo JSON debe contener un array de objetos con la siguiente estructura:

```json
[
  {
    "id": 1,
    "tema": "Medicina General",
    "pregunta": "¿Cuál es el tratamiento de primera línea para la hipertensión arterial?",
    "opciones": [
      "A) Diuréticos tiazídicos",
      "B) Beta bloqueadores",
      "C) Inhibidores de la ECA",
      "D) Bloqueadores de canales de calcio"
    ],
    "correcta": "A) Diuréticos tiazídicos",
    "explicacion": "Los diuréticos tiazídicos son el tratamiento de primera línea según las guías actuales."
  }
]
```

### Campos requeridos:
- `id`: Número único de identificación
- `pregunta`: Texto de la pregunta
- `opciones`: Array con las opciones de respuesta
- `correcta`: Respuesta correcta (debe coincidir exactamente con una opción)

### Campos opcionales:
- `tema`: Categoría o tema de la pregunta
- `explicacion`: Explicación de la respuesta correcta

## 🎯 Uso

1. **Cargar banco de preguntas**: Arrastra o selecciona un archivo .json con el formato especificado

2. **Configurar examen**: Elige entre:
   - Examen CACES completo (100 preguntas, 160 minutos)
   - Práctica corta (50 preguntas, 80 minutos)
   - Personalizado (número de preguntas a elección)

3. **Realizar el examen**:
   - Responde las preguntas en orden o salta entre ellas
   - Marca preguntas para revisión
   - Observa el cronómetro
   - Entrega cuando estés listo o cuando se acabe el tiempo

4. **Revisar resultados**:
   - Visualiza tu calificación y estadísticas
   - Filtra por preguntas correctas/incorrectas
   - Lee las explicaciones de tus errores

## 🛠️ Tecnologías

- **React 18** - Framework de UI
- **Vite** - Build tool y dev server
- **Tailwind CSS** - Framework de estilos
- **JavaScript ES6+** - Lenguaje de programación

## 📱 Características Responsivas

- Desktop: Panel lateral de navegación permanente
- Móvil: Panel de navegación en modal
- Diseño adaptable para tablets

## 🎨 Personalización

### Colores
Puedes modificar los colores en `tailwind.config.js` para personalizar la paleta:

```js
theme: {
  extend: {
    colors: {
      // Tus colores personalizados
    }
  }
}
```

### Tiempo por pregunta
El cálculo actual es 1.6 minutos por pregunta. Puedes ajustarlo en `ExamConfig.jsx`:

```js
time: Math.ceil(customCount * 1.6), // Cambia 1.6 por tu valor
```

## 🚀 Build para Producción

```bash
npm run build
```

Los archivos optimizados se generarán en la carpeta `dist/`

## 📝 Ejemplo de JSON Completo

Puedes encontrar un ejemplo de JSON en `example-questions.json` (crear este archivo con al menos 10 preguntas para pruebas).

## 🤝 Contribuciones

Este es un proyecto base. Siéntete libre de extenderlo con:
- Estadísticas avanzadas
- Guardado de progreso en localStorage
- Exportación de resultados a PDF
- Integración con backend
- Modos de estudio adicionales

## 📄 Licencia

MIT License - Uso libre para proyectos personales y educativos.

---

Desarrollado como simulador de exámenes médicos CACES 🩺
