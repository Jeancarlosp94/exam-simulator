import { useCallback, useEffect, useRef, useState } from "react";
import Timer from "./Timer";
import QuestionCard from "./QuestionCard";
import QuestionGrid from "./QuestionGrid";
import useExamStore from "../store/useExamStore";
import useTimer from "../hooks/useTimer";

const ExamSimulator = ({ onComplete }) => {
  const selectedQuestions = useExamStore((state) => state.selectedQuestions);
  const config = useExamStore((state) => state.config);
  const userAnswers = useExamStore((state) => state.userAnswers);
  const setUserAnswer = useExamStore((state) => state.setUserAnswer);
  const setResults = useExamStore((state) => state.setResults);

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [flagged, setFlagged] = useState(new Set());
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showQuestionGrid, setShowQuestionGrid] = useState(false);

  if (!config || !selectedQuestions.length) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        <p className="text-center">
          Cargando configuración... asegúrate de haber cargado un banco válido.
        </p>
      </div>
    );
  }

  const initialSeconds = config.timeLimit * 60;
  const latestTimeRef = useRef(initialSeconds);
  const hasSubmittedRef = useRef(false);
  const stopRef = useRef(() => {});

  const finalizeExam = useCallback(
    (timeLeftOverride) => {
      if (hasSubmittedRef.current) return;
      hasSubmittedRef.current = true;
      stopRef.current();
      const timeLeftAtSubmit =
        typeof timeLeftOverride === "number"
          ? timeLeftOverride
          : latestTimeRef.current;
      const timeSpent = Math.max(0, initialSeconds - timeLeftAtSubmit);

      const resultsPayload = {
        totalQuestions: selectedQuestions.length,
        answers: userAnswers,
        questions: selectedQuestions,
        timeSpent,
        config,
      };

      setResults(resultsPayload);
      setShowConfirmSubmit(false);
      onComplete(resultsPayload);
    },
    [
      initialSeconds,
      selectedQuestions,
      userAnswers,
      config,
      onComplete,
      setResults,
    ],
  );

  const { timeLeft, stop } = useTimer({
    initialSeconds,
    onFinish: finalizeExam,
  });

  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  useEffect(() => {
    latestTimeRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    setCurrentQuestion(0);
    setFlagged(new Set());
    setShowConfirmSubmit(false);
    setShowQuestionGrid(false);
    hasSubmittedRef.current = false;
  }, [selectedQuestions.length]);

  const handleAnswer = (answer) => {
    setUserAnswer(currentQuestion, answer);
  };

  const handleFlag = () => {
    const newFlagged = new Set(flagged);
    if (newFlagged.has(currentQuestion)) {
      newFlagged.delete(currentQuestion);
    } else {
      newFlagged.add(currentQuestion);
    }
    setFlagged(newFlagged);
  };

  const handleConfirmSubmit = () => {
    setShowConfirmSubmit(false);
    finalizeExam(latestTimeRef.current);
  };

  const goToQuestion = (index) => {
    setCurrentQuestion(index);
    setShowQuestionGrid(false);
  };

  const getQuestionStatus = (index) => {
    if (userAnswers[index] !== undefined) return "answered";
    if (flagged.has(index)) return "flagged";
    return "pending";
  };

  const answeredCount = Object.keys(userAnswers).length;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-4 mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{config.mode}</h2>
            <p className="text-sm text-gray-600">
              Pregunta {currentQuestion + 1} de {selectedQuestions.length}
            </p>
          </div>

          <Timer timeLeft={timeLeft} />

          <div className="flex gap-2">
            <button
              onClick={() => setShowQuestionGrid(!showQuestionGrid)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
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
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              Panel
            </button>
            <button
              onClick={() => setShowConfirmSubmit(true)}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
            >
              Entregar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3">
            <QuestionCard
              question={selectedQuestions[currentQuestion]}
              questionNumber={currentQuestion + 1}
              selectedAnswer={userAnswers[currentQuestion]}
              isFlagged={flagged.has(currentQuestion)}
              onAnswer={handleAnswer}
              onFlag={handleFlag}
              onPrevious={() =>
                setCurrentQuestion(Math.max(0, currentQuestion - 1))
              }
              onNext={() =>
                setCurrentQuestion(
                  Math.min(selectedQuestions.length - 1, currentQuestion + 1),
                )
              }
              isFirst={currentQuestion === 0}
              isLast={currentQuestion === selectedQuestions.length - 1}
            />
          </div>

          <div className="hidden lg:block">
            <QuestionGrid
              totalQuestions={selectedQuestions.length}
              currentQuestion={currentQuestion}
              getQuestionStatus={getQuestionStatus}
              onQuestionClick={goToQuestion}
            />
          </div>
        </div>

        {showQuestionGrid && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 lg:hidden">
            <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">Navegación</h3>
                <button
                  onClick={() => setShowQuestionGrid(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <QuestionGrid
                totalQuestions={selectedQuestions.length}
                currentQuestion={currentQuestion}
                getQuestionStatus={getQuestionStatus}
                onQuestionClick={goToQuestion}
              />
            </div>
          </div>
        )}

        {showConfirmSubmit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                ¿Entregar examen?
              </h3>
              <p className="text-gray-600 mb-6">
                Has respondido {answeredCount} de {selectedQuestions.length}{" "}
                preguntas.
                {answeredCount < selectedQuestions.length && (
                  <span className="block mt-2 text-amber-600 font-semibold">
                    ⚠️ Aún tienes preguntas sin responder
                  </span>
                )}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmSubmit(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamSimulator;
