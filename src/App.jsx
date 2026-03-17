import { useState } from "react";
import FileUpload from "./components/FileUpload";
import ExamConfig from "./components/ExamConfig";
import ExamSimulator from "./components/ExamSimulator";
import Results from "./components/Results";
import useExamStore from "./store/useExamStore";

function App() {
  const [step, setStep] = useState("upload"); // 'upload', 'config', 'exam', 'results'
  const setBankQuestions = useExamStore((state) => state.setBankQuestions);
  const resetExamProgress = useExamStore((state) => state.resetExamProgress);

  const handleFileLoaded = () => {
    setStep("config");
  };

  const handleConfigComplete = (config) => {
    setStep("exam");
  };

  const handleExamComplete = (results) => {
    setStep("results");
  };

  const handleRestart = () => {
    setStep("upload");
    setBankQuestions([]);
  };

  const handleRetakeExam = () => {
    setStep("config");
    resetExamProgress();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {step === "upload" && <FileUpload onUploaded={handleFileLoaded} />}
      {step === "config" && (
        <ExamConfig
          onConfigComplete={handleConfigComplete}
          onBack={() => setStep("upload")}
        />
      )}
      {step === "exam" && <ExamSimulator onComplete={handleExamComplete} />}
      {step === "results" && (
        <Results onRestart={handleRestart} onRetake={handleRetakeExam} />
      )}
    </div>
  );
}

export default App;
