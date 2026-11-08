// Synthesizes sound effects via Web Audio API without requiring any external assets.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

// Gentle pleasant ascending chime when file transfer finishes successfully (C5 -> E5 -> G5)
export function playSuccessChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [
    { freq: 523.25, time: 0.00, dur: 0.28 }, // C5
    { freq: 659.25, time: 0.10, dur: 0.28 }, // E5
    { freq: 783.99, time: 0.20, dur: 0.45 }, // G5
  ];

  notes.forEach(({ freq, time, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + time);

    gain.gain.setValueAtTime(0.0001, now + time);
    gain.gain.exponentialRampToValueAtTime(0.08, now + time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + time);
    osc.stop(now + time + dur);
  });
}

// Chime when a peer device is discovered or paired via PIN (F#5 -> C#6)
export function playPeerConnectedChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [
    { freq: 739.99, time: 0.00, dur: 0.22 }, // F#5
    { freq: 1108.73, time: 0.11, dur: 0.38 }, // C#6
  ];

  notes.forEach(({ freq, time, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + time);

    gain.gain.setValueAtTime(0.0001, now + time);
    gain.gain.exponentialRampToValueAtTime(0.07, now + time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + time);
    osc.stop(now + time + dur);
  });
}

// Subtle high-tech chirp for transfer start
export function playStartTone() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.14);
}

// Soft discrete tone for error/cancellation
export function playErrorTone() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.linearRampToValueAtTime(220, now + 0.22);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.05, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.22);
}

