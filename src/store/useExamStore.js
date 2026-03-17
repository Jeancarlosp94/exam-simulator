import { create } from 'zustand';

const useExamStore = create((set) => ({
   bankQuestions: [],
   selectedQuestions: [],
   config: null,
   userAnswers: {},
   results: null,

   setBankQuestions: (questions) =>
      set({
         bankQuestions: questions,
         selectedQuestions: [],
         config: null,
         userAnswers: {},
         results: null,
      }),

   setSelectedQuestions: (questions) => set({ selectedQuestions: questions }),
   setConfig: (config) => set({ config }),
   setUserAnswer: (index, answer) =>
      set((state) => ({
         userAnswers: {
            ...state.userAnswers,
            [index]: answer,
         },
      })),
   resetUserAnswers: () => set({ userAnswers: {} }),
   setResults: (results) => set({ results }),
   resetExamProgress: () =>
      set({
         selectedQuestions: [],
         config: null,
         userAnswers: {},
         results: null,
      }),
}));

export default useExamStore;
