import { useState } from "react";
import useExamStore from "../store/useExamStore";

const FileUpload = ({ onUploaded }) => {
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const setBankQuestions = useExamStore((state) => state.setBankQuestions);

  const normalizeQuestion = (raw, index) => {
    const { opciones, pregunta, respuesta_correcta, explicacion_clinica } = raw;
    if (!pregunta) {
      throw new Error(`Pregunta ${index + 1}: falta la propiedad "pregunta"`);
    }
    if (!opciones || typeof opciones !== "object") {
      throw new Error(
        `Pregunta ${index + 1}: "opciones" debe ser un objeto con letras como claves`,
      );
    }

    const optionEntries = Object.entries(opciones);
    if (optionEntries.length < 2) {
      throw new Error(`Pregunta ${index + 1}: debe tener al menos 2 opciones`);
    }

    const normalizedOptions = optionEntries.map(([label, text]) => ({
      label,
      text,
    }));

    if (
      !respuesta_correcta ||
      !normalizedOptions.find((opt) => opt.label === respuesta_correcta)
    ) {
      throw new Error(
        `Pregunta ${index + 1}: "respuesta_correcta" debe coincidir con una de las letras de opciones`,
      );
    }

    return {
      ...raw,
      opciones: normalizedOptions,
      correcta: respuesta_correcta,
      explicacion: explicacion_clinica,
    };
  };

  const validateJSON = (data) => {
    if (!Array.isArray(data)) {
      throw new Error("El archivo debe contener un array de preguntas");
    }

    data.forEach((item, index) => {
      if (
        !item.id ||
        !item.pregunta ||
        !item.opciones ||
        !item.respuesta_correcta
      ) {
        throw new Error(
          `Pregunta ${index + 1}: falta información requerida (id, pregunta, opciones, respuesta_correcta)`,
        );
      }
    });

    return true;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    processFile(file);
  };

  const processFile = (file) => {
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setError("Por favor selecciona un archivo .json válido");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawData = JSON.parse(event.target.result);
        validateJSON(rawData);
        const normalized = rawData.map(normalizeQuestion);
        setError("");
        setBankQuestions(normalized);
        onUploaded?.(normalized);
      } catch (err) {
        setError(`Error: ${err.message}`);
      }
    };
    reader.onerror = () => {
      setError("Error al leer el archivo");
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    processFile(file);
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Simulador de Exámenes CACES
          </h1>
          <p className="text-gray-600">
            Prepárate para tu examen médico con nuestro simulador profesional
          </p>
        </div>

        <div
          className={`border-4 border-dashed rounded-xl p-12 text-center transition-all ${
            isDragging
              ? "border-indigo-500 bg-indigo-50"
              : "border-gray-300 hover:border-indigo-400"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <svg
            className="mx-auto h-16 w-16 text-gray-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          <label htmlFor="file-upload" className="cursor-pointer">
            <span className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
              Seleccionar archivo JSON
            </span>
            <input
              id="file-upload"
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <p className="mt-4 text-sm text-gray-500">
            o arrastra y suelta tu archivo aquí
          </p>
        </div>

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold text-gray-800 mb-3">
            Formato del archivo JSON:
          </h3>
          <pre className="bg-gray-800 text-green-400 p-4 rounded-lg overflow-x-auto text-xs">
            {`[
  {
    "id": 1,
    "especialidad": "Medicina",
    "subtema": "Emergencias respiratorias",
    "pregunta": "¿Cuál es...?",
    "opciones": {
      "A": "Respuesta A",
      "B": "Respuesta B",
      "C": "Respuesta C"
    },
    "respuesta_correcta": "A",
    "explicacion_clinica": {
      "razonamiento": "...",
      "diferencial": "...",
      "por_que_no_las_otras": "...",
      "conducta_según_guias": "..."
    },
    "fuente_clinica": "Fuente"
  }
]`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
