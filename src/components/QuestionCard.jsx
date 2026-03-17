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
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-semibold">
              Pregunta {questionNumber}
            </span>
            {question.tema && (
              <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                {question.tema}
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

      <div className="mb-6">
        <p className="text-lg text-gray-800 leading-relaxed">
          {question.pregunta}
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {question.opciones.map((opcion, index) => {
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
