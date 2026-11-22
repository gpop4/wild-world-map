import { useCallback, useEffect, useRef, useState } from 'react';

export interface SpeechSegment {
  id: string;
  text: string;
}

export function useSpeech() {
  const [supported] = useState(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window
  );
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [rate, setRate] = useState<number>(0.78);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  const runIdRef = useRef<number>(0);
  const rateRef = useRef<number>(rate);
  const pauseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    if (!supported) return;

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      const english = available.filter((v) => v.lang.toLowerCase().startsWith('en'));
      const list = english.length > 0 ? english : available;
      setVoices(list);

      if (!selectedVoiceURI && list.length > 0) {
        // Prefer friendly natural English voices on macOS / iOS / Chrome
        const preferredNames = [
          'Samantha',
          'Google US English',
          'Karen',
          'Moira',
          'Tessa',
          'Daniel',
          'Alex',
        ];
        const match =
          preferredNames
            .map((name) => list.find((v) => v.name.includes(name)))
            .find(Boolean) || list[0];
        if (match) {
          setSelectedVoiceURI(match.voiceURI);
        }
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [supported, selectedVoiceURI]);

  const clearPauseTimer = useCallback(() => {
    if (pauseTimerRef.current !== null) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    runIdRef.current += 1;
    clearPauseTimer();
    if (supported) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setActiveSegmentId(null);
  }, [supported, clearPauseTimer]);

  const pause = useCallback(() => {
    if (!supported || !isSpeaking) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
  }, [supported, isSpeaking]);

  const resume = useCallback(() => {
    if (!supported || !isPaused) return;
    window.speechSynthesis.resume();
    setIsPaused(false);
  }, [supported, isPaused]);

  const speakQueue = useCallback(
    (segments: SpeechSegment[]) => {
      if (!supported || segments.length === 0) return;

      runIdRef.current += 1;
      const currentRunId = runIdRef.current;

      clearPauseTimer();
      window.speechSynthesis.cancel();
      setIsSpeaking(true);
      setIsPaused(false);

      const chosenVoice = voices.find((v) => v.voiceURI === selectedVoiceURI) || null;

      const speakIndex = (idx: number) => {
        if (runIdRef.current !== currentRunId) return;
        if (idx >= segments.length) {
          setIsSpeaking(false);
          setIsPaused(false);
          setActiveSegmentId(null);
          return;
        }

        const seg = segments[idx];
        const utterance = new SpeechSynthesisUtterance(seg.text);
        if (chosenVoice) {
          utterance.voice = chosenVoice;
        }
        utterance.rate = rateRef.current;
        utterance.pitch = 1.0;

        utterance.onstart = () => {
          if (runIdRef.current === currentRunId) {
            setActiveSegmentId(seg.id);
          }
        };

        utterance.onend = () => {
          if (runIdRef.current === currentRunId) {
            pauseTimerRef.current = window.setTimeout(() => {
              pauseTimerRef.current = null;
              speakIndex(idx + 1);
            }, 450);
          }
        };

        utterance.onerror = () => {
          if (runIdRef.current === currentRunId) {
            clearPauseTimer();
            setIsSpeaking(false);
            setIsPaused(false);
            setActiveSegmentId(null);
          }
        };

        window.speechSynthesis.speak(utterance);
      };

      speakIndex(0);
    },
    [supported, voices, selectedVoiceURI, clearPauseTimer]
  );

  const speakText = useCallback(
    (text: string, segmentId = 'single') => {
      speakQueue([{ id: segmentId, text }]);
    },
    [speakQueue]
  );

  useEffect(() => {
    return () => {
      clearPauseTimer();
      if (supported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [supported, clearPauseTimer]);

  return {
    supported,
    voices,
    selectedVoiceURI,
    setSelectedVoiceURI,
    rate,
    setRate,
    isSpeaking,
    isPaused,
    activeSegmentId,
    speakQueue,
    speakText,
    pause,
    resume,
    stop,
  };
}
