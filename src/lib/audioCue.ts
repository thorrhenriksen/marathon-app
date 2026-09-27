// Single short beep via the Web Audio API, used to mark the end of the
// guided-mode rest timer. No vibration is ever used.

let audioContext: AudioContext | null = null

/** Must be called from a user-gesture handler (e.g. the "Start" tap) so the
 *  context is unlocked on iOS. Safe to call repeatedly. */
export function primeAudioCue(): void {
  if (audioContext) return
  try {
    audioContext = new AudioContext()
  } catch {
    audioContext = null
  }
}

export function playAudioCue(): void {
  if (!audioContext) return
  try {
    if (audioContext.state === 'suspended') {
      void audioContext.resume()
    }
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.2, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3)
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.3)
  } catch {
    // ignore — audio cues are a nice-to-have, never required
  }
}
