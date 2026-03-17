const QuestionCard = ({
  question,
  questionNumber,
  selectedAnswer,
  isFlagged,
  onAnswer,
  onFlag,
  onPrevious,
  onNext,
  isFirst,
  isLast,
}) => {
  const hasClinicalData =
    question.caso_clinico ||
    question.signos_vitales ||
    question.laboratorio ||
    question.imagen_descrita;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-semibold">
              Pregunta {questionNumber}
            </span>
            {question.tema && (
              <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                {question.tema}
              </span>
            )}
            {question.dificultad && (
              <span className="bg-amber-100 text-amber-600 px-3 py-1 rounded-full text-sm">
                {question.dificultad}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onFlag}
          className={`p-2 rounded-lg transition-colors ${
            isFlagged
              ? "bg-amber-100 text-amber-600"
              : "bg-gray-100 text-gray-400 hover:text-gray-600"
          }`}
          title={isFlagged ? "Desmarcar" : "Marcar para revisión"}
        >
          <svg
            className="w-6 h-6"
            fill={isFlagged ? "currentColor" : "none"}
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
            />
          </svg>
        </button>
      </div>

      {hasClinicalData && (
        <div className="space-y-4 mb-6 border border-gray-200 rounded-xl p-4 bg-gray-50 text-sm">
          {question.caso_clinico && (
            <div>
              <h4 className="text-gray-700 font-semibold mb-1">Caso clínico</h4>
              <p className="text-gray-800 leading-snug">
                {question.caso_clinico}
              </p>
            </div>
          )}
          {question.signos_vitales && (
            <div>
              <h4 className="text-gray-700 font-semibold mb-1">
                Signos vitales
              </h4>
              <div className="grid grid-cols-2 gap-2 text-gray-800">
                {Object.entries(question.signos_vitales).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <span className="font-semibold uppercase tracking-wide text-gray-500">
                      {key}:
                    </span>{" "}
                    {value}
                  </div>
                ))}
              </div>
            </div>
          )}
          {question.laboratorio && (
            <div>
              <h4 className="text-gray-700 font-semibold mb-1">Laboratorio</h4>
              <p className="text-gray-800 leading-snug">
                {question.laboratorio}
              </p>
            </div>
          )}
          {question.imagen_descrita && (
            <div>
              <h4 className="text-gray-700 font-semibold mb-1">
                Imagen descrita
              </h4>
              <p className="text-gray-800 leading-snug">
                {question.imagen_descrita}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mb-6">
        <p className="text-lg text-gray-800 leading-relaxed">
          {question.pregunta}
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {question.opciones.map((opcion) => {
          const isSelected = selectedAnswer === opcion.label;
          return (
            <button
              key={opcion.label}
              onClick={() => onAnswer(opcion.label)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                isSelected
                  ? "border-indigo-500 bg-indigo-50 shadow-md"
                  : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 font-semibold ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-500 text-white"
                      : "border-gray-300 text-gray-700"
                  }`}
                >
                  {opcion.label}
                </div>
                <span className="text-gray-800 leading-tight">
                  {opcion.text}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedAnswer && question.explicacion && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-xl mb-6 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-blue-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-semibold text-blue-900">
              Explicación clínica
            </span>
          </div>
          {question.explicacion.razonamiento && (
            <p className="text-blue-800 leading-relaxed">
              <span className="font-semibold text-sm text-blue-700">
                Razonamiento:
              </span>{" "}
              {question.explicacion.razonamiento}
            </p>
          )}
          {question.explicacion.diferencial && (
            <p className="text-blue-800 leading-relaxed">
              <span className="font-semibold text-sm text-blue-700">
                Diferencial:
              </span>{" "}
              {question.explicacion.diferencial}
            </p>
          )}
          {question.explicacion.por_que_no_las_otras && (
            <p className="text-blue-800 leading-relaxed">
              <span className="font-semibold text-sm text-blue-700">
                Por qué no las otras:
              </span>{" "}
              {question.explicacion.por_que_no_las_otras}
            </p>
          )}
          {question.explicacion.conducta_según_guias && (
            <p className="text-blue-800 leading-relaxed">
              <span className="font-semibold text-sm text-blue-700">
                Conducta según guías:
              </span>{" "}
              {question.explicacion.conducta_según_guias}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-between pt-4 border-t">
        <button
          onClick={onPrevious}
          disabled={isFirst}
          className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
            isFirst
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          ← Anterior
        </button>
        <button
          onClick={onNext}
          disabled={isLast}
          className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
            isLast
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
          }`}
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
};

export default QuestionCard;
