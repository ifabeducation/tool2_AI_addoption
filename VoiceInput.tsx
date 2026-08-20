"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square, Volume2, VolumeX } from "lucide-react";

/**
 * Dettatura e lettura vocale della chat, con le API del browser (Web Speech):
 * niente servizio esterno, niente audio che esce dal dispositivo. Su Chrome ed
 * Edge funziona; su Firefox il riconoscimento non c'è e il pulsante del
 * microfono resta nascosto invece di dare un errore al clic.
 */

type SpeechAlternative = { transcript: string };
type SpeechResult = { isFinal: boolean; length: number; 0: SpeechAlternative };
type SpeechResultList = { length: number; [index: number]: SpeechResult };
type SpeechEvent = { resultIndex: number; results: SpeechResultList };

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/**
 * Il supporto del browser è una capacità esterna a React e si può leggere solo
 * nel client: si legge con useSyncExternalStore (niente da sottoscrivere, non
 * cambia mai) così il render lato server dice "non supportato" e l'idratazione
 * resta coerente.
 */
const noSubscribe = () => () => {};
const notSupportedOnServer = () => false;

function recognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type Dictation = {
  supported: boolean;
  listening: boolean;
  /** Parte in corso di riconoscimento, da mostrare in grigio sotto il campo. */
  interim: string;
  error: string | null;
  toggle: () => void;
  stop: () => void;
};

/**
 * `onFinalText` riceve le frasi già riconosciute: chi la usa le accoda al
 * proprio campo di testo, così il partecipante rilegge e corregge prima di
 * inviare (non si invia mai da soli: in una sala con più voci sarebbe un guaio).
 */
export function useDictation(onFinalText: (text: string) => void, lang = "it-IT"): Dictation {
  const supported = useSyncExternalStore(
    noSubscribe,
    () => Boolean(recognitionCtor()),
    notSupportedOnServer
  );
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinalText);

  useEffect(() => {
    onFinalRef.current = onFinalText;
  });

  // Il microfono non deve restare aperto se si cambia step o si chiude la pagina.
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  const toggle = useCallback(() => {
    if (recognitionRef.current) {
      stop();
      recognitionRef.current = null;
      return;
    }

    const Ctor = recognitionCtor();
    if (!Ctor) {
      setError("Questo browser non supporta la dettatura vocale.");
      return;
    }

    const recognition = new Ctor();
    recognition.lang = lang;
    // Continuo: le risposte del workshop sono lunghe e le pause di riflessione
    // non devono chiudere il microfono.
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = "";
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += text;
        else pending += text;
      }
      setInterim(pending);
      if (finalText.trim()) onFinalRef.current(finalText.trim());
    };

    recognition.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "Microfono non autorizzato: consentilo nelle impostazioni del browser."
          : "Non ho sentito nulla, riprova."
      );
      setListening(false);
      setInterim("");
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setListening(false);
      setInterim("");
      recognitionRef.current = null;
    };

    setError(null);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError("Non riesco ad accendere il microfono.");
      recognitionRef.current = null;
    }
  }, [lang, stop]);

  return { supported, listening, interim, error, toggle, stop };
}

/** Pulsante microfono: acceso mentre ascolta, con l'icona di stop. */
export function MicButton({
  dictation,
  disabled,
}: {
  dictation: Dictation;
  disabled?: boolean;
}) {
  if (!dictation.supported) return null;

  return (
    <button
      type="button"
      onClick={dictation.toggle}
      disabled={disabled}
      title={dictation.listening ? "Ferma la dettatura" : "Rispondi a voce"}
      aria-label={dictation.listening ? "Ferma la dettatura" : "Rispondi a voce"}
      aria-pressed={dictation.listening}
      className={`flex shrink-0 items-center justify-center rounded-lg border px-3 py-2 transition disabled:opacity-50 ${
        dictation.listening
          ? "animate-pulse border-red-500 bg-red-500 text-white"
          : "border-ifab-border bg-white text-ifab-navy hover:border-ifab-blue hover:text-ifab-blue"
      }`}
    >
      {dictation.listening ? <Square size={16} /> : <Mic size={16} />}
    </button>
  );
}

/** Lettura ad alta voce delle risposte dell'agente (spenta per default). */
export function useSpeech(lang = "it-IT") {
  const [enabled, setEnabled] = useState(false);
  const supported = useSyncExternalStore(
    noSubscribe,
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    notSupportedOnServer
  );

  // Uscendo dalla pagina la voce si zittisce: continuerebbe a leggere da sola.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      window.speechSynthesis.speak(utterance);
    },
    [enabled, lang]
  );

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      if (prev && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      return !prev;
    });
  }, []);

  return { supported, enabled, speak, toggle };
}

/** Interruttore della lettura ad alta voce, accanto al titolo della chat. */
export function SpeakToggle({
  speech,
}: {
  speech: { supported: boolean; enabled: boolean; toggle: () => void };
}) {
  if (!speech.supported) return null;

  return (
    <button
      type="button"
      onClick={speech.toggle}
      title={speech.enabled ? "Non leggere le risposte" : "Leggi le risposte ad alta voce"}
      aria-label={speech.enabled ? "Non leggere le risposte" : "Leggi le risposte ad alta voce"}
      aria-pressed={speech.enabled}
      className={`rounded-lg p-1.5 transition ${
        speech.enabled
          ? "bg-ifab-blue/10 text-ifab-blue"
          : "text-ifab-text-muted hover:bg-ifab-bg-soft hover:text-ifab-navy"
      }`}
    >
      {speech.enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
    </button>
  );
}
