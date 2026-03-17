import { useMemo, useState } from "react";
import useExamStore from "../store/useExamStore";

const Results = ({ onRestart, onRetake }) => {
  const results = useExamStore((state) => state.results);
  const [showExplanations, setShowExplanations] = useState(false);
  const [filter, setFilter] = useState("all"); // 'all', 'correct', 'incorrect'

  const calculateResults = (resultsData) => {
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;
    const details = [];

    resultsData.questions.forEach((question, index) => {
      const userAnswer = resultsData.answers[index];
      const isCorrect = userAnswer === question.correcta;

      if (userAnswer === undefined) {
        unanswered++;
      } else if (isCorrect) {
        correct++;
      } else {
        incorrect++;
      }

      details.push({
        question,
        questionNumber: index + 1,
        userAnswer,
        isCorrect,
        isUnanswered: userAnswer === undefined,
      });
    });

    const percentage = ((correct / resultsData.totalQuestions) * 100).toFixed(
      1,
    );
    return { correct, incorrect, unanswered, percentage, details };
  };

  const stats = useMemo(() => {
    if (!results) return null;
    return calculateResults(results);
  }, [results]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const normalizedDetails =
    stats?.details?.filter((detail) => {
      if (filter === "correct") return detail.isCorrect;
      if (filter === "incorrect")
        return !detail.isCorrect && !detail.isUnanswered;
      return true;
    }) ?? [];

  if (!results || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-6">
        <p className="text-gray-600">
          No hay resultados guardados. Completa un examen para ver la revisión.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Results Summary */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-gray-800 mb-2">
              Resultados del Examen
            </h2>
            <p className="text-gray-600">{results.config.mode}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-6 text-white">
              <div className="text-5xl font-bold mb-2">{stats.percentage}%</div>
              <div className="text-indigo-100">Calificación</div>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
              <div className="text-5xl font-bold mb-2">{stats.correct}</div>
              <div className="text-green-100">Correctas</div>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white">
              <div className="text-5xl font-bold mb-2">{stats.incorrect}</div>
              <div className="text-red-100">Incorrectas</div>
            </div>
            <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl p-6 text-white">
              <div className="text-5xl font-bold mb-2">{stats.unanswered}</div>
              <div className="text-gray-100">Sin responder</div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-sm text-gray-600 mb-1">
                  Tiempo utilizado
                </div>
                <div className="text-xl font-semibold text-gray-800">
                  {formatTime(results.timeSpent)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Tiempo límite</div>
                <div className="text-xl font-semibold text-gray-800">
                  {results.config.timeLimit} minutos
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={onRetake}
              className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              Nuevo Examen
            </button>
            <button
              onClick={onRestart}
              className="px-8 py-3 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
            >
              Cambiar Banco
            </button>
            <button
              onClick={() => setShowExplanations(!showExplanations)}
              className="px-8 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-colors"
            >
              {showExplanations ? "Ocultar" : "Ver"} Explicaciones
            </button>
          </div>
        </div>

        {/* Detailed Review */}
        {showExplanations && (
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">
                Revisión Detallada
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    filter === "all"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Todas
                </button>
                <button
                  onClick={() => setFilter("correct")}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    filter === "correct"
                      ? "bg-green-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Correctas
                </button>
                <button
                  onClick={() => setFilter("incorrect")}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    filter === "incorrect"
                      ? "bg-red-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Incorrectas
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {normalizedDetails.map((detail) => (
                <div
                  key={detail.questionNumber}
                  className={`border-2 rounded-xl p-6 ${
                    detail.isUnanswered
                      ? "border-gray-300 bg-gray-50"
                      : detail.isCorrect
                        ? "border-green-300 bg-green-50"
                        : "border-red-300 bg-red-50"
                  }`}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        detail.isUnanswered
                          ? "bg-gray-400 text-white"
                          : detail.isCorrect
                            ? "bg-green-500 text-white"
                            : "bg-red-500 text-white"
                      }`}
                    >
                      {detail.questionNumber}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {detail.question.tema && (
                          <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm">
                            {detail.question.tema}
                          </span>
                        )}
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            detail.isUnanswered
                              ? "bg-gray-400 text-white"
                              : detail.isCorrect
                                ? "bg-green-500 text-white"
                                : "bg-red-500 text-white"
                          }`}
                        >
                          {detail.isUnanswered
                            ? "Sin responder"
                            : detail.isCorrect
                              ? "Correcta"
                              : "Incorrecta"}
                        </span>
                      </div>
                      <p className="text-lg text-gray-800 mb-4">
                        {detail.question.pregunta}
                      </p>

                      <div className="space-y-2 mb-4">
                        {detail.question.opciones.map((opcion, idx) => {
                          const isUserAnswer =
                            opcion.label === detail.userAnswer;
                          const isCorrectAnswer =
                            opcion.label === detail.question.correcta;

                          return (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg border-2 ${
                                isCorrectAnswer
                                  ? "border-green-500 bg-green-100"
                                  : isUserAnswer
                                    ? "border-red-500 bg-red-100"
                                    : "border-gray-200 bg-white"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {isCorrectAnswer && (
                                  <svg
                                    className="w-5 h-5 text-green-600"
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
                                {isUserAnswer && !isCorrectAnswer && (
                                  <svg
                                    className="w-5 h-5 text-red-600"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                                <div>
                                  <div className="text-sm font-semibold text-gray-600">
                                    {opcion.label}
                                  </div>
                                  <span className="text-gray-800">
                                    {opcion.text}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {detail.question.explicacion && (
                        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                          <div className="flex items-start gap-2">
                            <svg
                              className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <div>
                              <div className="font-semibold text-blue-900 mb-1">
                                Explicación clínica
                              </div>
                              {detail.question.explicacion.razonamiento && (
                                <p className="text-blue-800 mb-1">
                                  <span className="font-semibold">
                                    Razonamiento:
                                  </span>{" "}
                                  {detail.question.explicacion.razonamiento}
                                </p>
                              )}
                              {detail.question.explicacion.diferencial && (
                                <p className="text-blue-800 mb-1">
                                  <span className="font-semibold">
                                    Diferencial:
                                  </span>{" "}
                                  {detail.question.explicacion.diferencial}
                                </p>
                              )}
                              {detail.question.explicacion
                                .por_que_no_las_otras && (
                                <p className="text-blue-800 mb-1">
                                  <span className="font-semibold">
                                    Por qué no las otras:
                                  </span>{" "}
                                  {
                                    detail.question.explicacion
                                      .por_que_no_las_otras
                                  }
                                </p>
                              )}
                              {detail.question.explicacion
                                .conducta_según_guias && (
                                <p className="text-blue-800 mb-0">
                                  <span className="font-semibold">
                                    Conducta según guías:
                                  </span>{" "}
                                  {
                                    detail.question.explicacion
                                      .conducta_según_guias
                                  }
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Results;
