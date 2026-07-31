/** Play stored MW audio, or fall back to browser TTS for the English word. */
export function playWordAudio(opts: {
  audioUrl?: string | null;
  word: string;
}): void {
  const url = opts.audioUrl?.trim();
  if (url) {
    const src = url.startsWith("//") ? `https:${url}` : url;
    const audio = new Audio(src);
    void audio.play().catch(() => speakWord(opts.word));
    return;
  }
  speakWord(opts.word);
}

function speakWord(word: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const text = word.trim();
  if (!text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.rate = 0.9;
  window.speechSynthesis.speak(utter);
}
