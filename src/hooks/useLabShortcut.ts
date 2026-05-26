import { useEffect, useRef, useCallback } from 'react';

/**
 * Secret Lab Access Hook
 * Detects the key sequence: L → A → B (within 1.5s)
 * then calls the provided callback to open the lab.
 *
 * The sequence resets if:
 *  - more than 1.5s passes between keys
 *  - a wrong key is pressed
 */
export function useLabShortcut(onActivate: () => void) {
  const sequence = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const TARGET = ['l', 'a', 'b'];

  const reset = useCallback(() => {
    sequence.current = [];
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Ignore when typing in inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const key = e.key.toLowerCase();
      const expected = TARGET[sequence.current.length];

      if (key === expected) {
        sequence.current = [...sequence.current, key];

        // Reset timeout on each correct key
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(reset, 1500);

        if (sequence.current.length === TARGET.length) {
          reset();
          onActivate();
        }
      } else {
        reset();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [onActivate, reset]);
}
