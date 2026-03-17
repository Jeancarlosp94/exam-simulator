import { useEffect, useState } from "react";
import useExamStore from "../store/useExamStore";
import { buildQuiz } from "../utils/quizEngine";

const ExamConfig = ({ onConfigComplete, onBack }) => {
  const [selectedMode, setSelectedMode] = useState("caces");
  const [customCount, setCustomCount] = useState(50);
  const bankQuestions = useExamStore((state) => state.bankQuestions);
  const setSelectedQuestions = useExamStore(
    (state) => state.setSelectedQuestions,
  );
  const setConfig = useExamStore((state) => state.setConfig);

  useEffect(() => {
    if (bankQuestions.length) {
      setCustomCount((prev) =>
        Math.max(10, Math.min(bankQuestions.length, prev)),
      );
    }
  }, [bankQuestions.length]);

  const modes = [
    {
      id: "caces",
      name: "Examen CACES Completo",
      description: "100 preguntas en 160 minutos",
      count: 100,
      time: 160,
      icon: "🎓",
    },
    {
      id: "practice50",
      name: "Práctica Corta",
      description: "50 preguntas en 80 minutos",
      count: 50,
      time: 80,
      icon: "📝",
    },
    {
      id: "custom",
      name: "Personalizado",
      description: "Elige el número de preguntas",
      count: customCount,
      time: Math.ceil(customCount * 1.6),
      icon: "⚙️",
    },
  ];

  const handleStart = () => {
    const mode = modes.find((m) => m.id === selectedMode);
    const count = selectedMode === "custom" ? customCount : mode.count;

    if (count > bankQuestions.length) {
      alert(
        `Solo hay ${bankQuestions.length} preguntas disponibles en el banco`,
      );
      return;
    }

    const selectedQuestions = buildQuiz(bankQuestions, count);
    const newConfig = {
      mode: mode.name,
      questionCount: count,
      timeLimit: mode.time,
      questions: selectedQuestions,
    };
    setSelectedQuestions(selectedQuestions);
    setConfig(newConfig);
    onConfigComplete(newConfig);
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-3xl w-full">
        <button
          onClick={onBack}
          className="mb-6 text-gray-600 hover:text-gray-800 flex items-center gap-2 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Volver
        </button>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            Configura tu Examen
          </h2>
          <p className="text-gray-600">
            Banco disponible:{" "}
            <span className="font-semibold text-indigo-600">
              {bankQuestions.length} preguntas
            </span>
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {modes.map((mode) => (
            <div
              key={mode.id}
              onClick={() => setSelectedMode(mode.id)}
              className={`border-2 rounded-xl p-6 cursor-pointer transition-all ${
                selectedMode === mode.id
                  ? "border-indigo-500 bg-indigo-50 shadow-lg"
                  : "border-gray-200 hover:border-indigo-300 hover:shadow-md"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{mode.icon}</div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-800 mb-1">
                    {mode.name}
                  </h3>
                  <p className="text-gray-600">{mode.description}</p>

                  {mode.id === "custom" && selectedMode === "custom" && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Número de preguntas:
                      </label>
                      <input
                        type="number"
                        min="10"
                        max={bankQuestions.length}
                        value={customCount}
                        onChange={(e) =>
                          setCustomCount(
                            Math.max(
                              10,
                              Math.min(
                                bankQuestions.length,
                                parseInt(e.target.value) || 10,
                              ),
                            ),
                          )
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <p className="mt-2 text-sm text-gray-500">
                        Tiempo estimado: {Math.ceil(customCount * 1.6)} minutos
                      </p>
                    </div>
                  )}
                </div>
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selectedMode === mode.id
                      ? "border-indigo-500 bg-indigo-500"
                      : "border-gray-300"
                  }`}
                >
                  {selectedMode === mode.id && (
                    <svg
                      className="w-4 h-4 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleStart}
          className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
        >
          Iniciar Examen
        </button>
      </div>
    </div>
  );
};

export default ExamConfig;
