const fisherYates = (array) => {
   const result = [...array];
   for (let i = result.length - 1; i > 0; i -= 1) {
      const randomIndex = Math.floor(Math.random() * (i + 1));
      [result[i], result[randomIndex]] = [result[randomIndex], result[i]];
   }
   return result;
};

export const buildQuiz = (bank, count) => {
   const safeCount = Math.min(count, bank.length);
   const selected = fisherYates(bank).slice(0, safeCount);
   return selected.map((question) => ({
      ...question,
      opciones: fisherYates(question.opciones),
   }));
};
