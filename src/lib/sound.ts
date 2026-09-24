// Timbre de cocina sintetizado con WebAudio (sin archivos de audio).
// Los navegadores bloquean audio hasta un gesto del usuario: llamar
// unlockAudio() desde un click (pantalla "Activar cocina").

let ctx: AudioContext | null = null

export function unlockAudio() {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx.state !== 'closed'
}

function tone(freq: number, start: number, dur: number, gain = 0.35) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, ctx.currentTime + start)
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur)
  osc.connect(g).connect(ctx.destination)
  osc.start(ctx.currentTime + start)
  osc.stop(ctx.currentTime + start + dur + 0.05)
}

/** "ding-ding" de campana de cocina */
export function playNewOrderChime() {
  if (!ctx || ctx.state !== 'running') return
  tone(1318.5, 0, 0.5)
  tone(1760, 0.14, 0.7)
  tone(1318.5, 0.6, 0.5)
  tone(1760, 0.74, 0.9)
}
