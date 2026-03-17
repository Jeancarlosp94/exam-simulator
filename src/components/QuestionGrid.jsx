const QuestionGrid = ({ totalQuestions, currentQuestion, getQuestionStatus, onQuestionClick }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'answered':
        return 'bg-green-500 text-white';
      case 'flagged':
        return 'bg-amber-400 text-white';
      default:
        return 'bg-gray-200 text-gray-700';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      <h3 className="text-lg font-bold text-gray-800 mb-4">Navegación</h3>
      
      <div className="mb-4 space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500"></div>
          <span className="text-gray-600">Respondida</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-amber-400"></div>
          <span className="text-gray-600">Marcada</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-200"></div>
          <span className="text-gray-600">Pendiente</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 max-h-[60vh] overflow-y-auto">
        {Array.from({ length: totalQuestions }, (_, i) => {
          const status = getQuestionStatus(i);
          const isCurrent = i === currentQuestion;
          return (
            <button
              key={i}
              onClick={() => onQuestionClick(i)}
              className={`
                aspect-square rounded-lg font-semibold text-sm transition-all
                ${getStatusColor(status)}
                ${isCurrent ? 'ring-4 ring-indigo-500 ring-offset-2' : ''}
                hover:scale-110 hover:shadow-lg
              `}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuestionGrid;
