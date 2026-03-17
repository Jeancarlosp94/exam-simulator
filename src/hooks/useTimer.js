import { useCallback, useEffect, useRef, useState } from 'react';

const useTimer = ({ initialSeconds, onFinish }) => {
   const [timeLeft, setTimeLeft] = useState(initialSeconds);
   const intervalRef = useRef(null);
   const callbackRef = useRef(onFinish);
   const initialRef = useRef(initialSeconds);

   useEffect(() => {
      callbackRef.current = onFinish;
   }, [onFinish]);

   useEffect(() => {
      setTimeLeft(initialSeconds);
      initialRef.current = initialSeconds;
   }, [initialSeconds]);

   useEffect(() => {
      if (intervalRef.current) {
         clearInterval(intervalRef.current);
      }

      if (initialSeconds <= 0) {
         callbackRef.current?.(initialSeconds);
         return () => undefined;
      }

      intervalRef.current = setInterval(() => {
         setTimeLeft((prev) => {
            if (prev <= 1) {
               clearInterval(intervalRef.current);
               intervalRef.current = null;
               callbackRef.current?.(0);
               return 0;
            }
            return prev - 1;
         });
      }, 1000);

      return () => {
         if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
         }
      };
   }, [initialSeconds]);

   const stop = useCallback(() => {
      if (intervalRef.current) {
         clearInterval(intervalRef.current);
         intervalRef.current = null;
      }
   }, []);

   return { timeLeft, stop, initialSeconds: initialRef.current };
};

export default useTimer;
