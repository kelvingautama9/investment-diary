import type { TradingSignal } from '../types';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
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
}

/**
 * Synthesizes an institutional Bloomberg terminal audio alert chime
 */
export function playTerminalChime(type: 'BUY' | 'SELL' | 'ALERT' = 'ALERT'): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    if (type === 'BUY') {
      // Ascending pleasant major chord
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880.0, now + 0.18); // A5
      osc2.frequency.setValueAtTime(739.99, now); // F#5
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.18); // D6
    } else if (type === 'SELL') {
      // Descending warning chord
      osc1.frequency.setValueAtTime(880.0, now);
      osc1.frequency.exponentialRampToValueAtTime(587.33, now + 0.2);
      osc2.frequency.setValueAtTime(698.46, now); // F5
      osc2.frequency.exponentialRampToValueAtTime(440.0, now + 0.2); // A4
    } else {
      osc1.frequency.setValueAtTime(800, now);
      osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
      osc2.frequency.setValueAtTime(1200, now);
      osc2.frequency.exponentialRampToValueAtTime(1600, now + 0.15);
    }

    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.36);
    osc2.stop(now + 0.36);
  } catch (err) {
    console.warn('Audio alert error:', err);
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

export function triggerSignalNotification(signal: TradingSignal): void {
  // Audio chime
  playTerminalChime(signal.direction);

  // Push notification
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`[APEX ALGO] ${signal.direction} ${signal.symbol} (${signal.strengthGrade}-Grade)`, {
        body: `${signal.setupType} | Score: ${signal.confidenceScore}% | Entry: $${signal.entry.toLocaleString()}`,
        icon: '/favicon.ico',
        tag: signal.id,
      });
    } catch (err) {
      console.warn('Notification trigger error:', err);
    }
  }
}
