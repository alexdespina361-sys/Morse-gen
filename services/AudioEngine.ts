export class AudioEngine {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private oscillator: OscillatorNode | null = null;

  constructor() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  }

  public init() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playTone(frequency: number, volume: number) {
    if (!this.ctx) return;
    
    this.oscillator = this.ctx.createOscillator();
    this.gainNode = this.ctx.createGain();

    this.oscillator.type = 'sine';
    this.oscillator.frequency.value = frequency;
    
    this.oscillator.connect(this.gainNode);
    this.gainNode.connect(this.ctx.destination);

    this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.005);
    
    this.oscillator.start();
  }

  public stopTone() {
    if (!this.ctx || !this.gainNode || !this.oscillator) return;

    const now = this.ctx.currentTime;
    
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
    this.gainNode.gain.linearRampToValueAtTime(0, now + 0.005);
    
    const osc = this.oscillator;
    const gain = this.gainNode;
    
    setTimeout(() => {
        try {
            osc.stop();
            osc.disconnect();
            gain.disconnect();
        } catch (e) {
        }
    }, 10); 

    this.oscillator = null;
    this.gainNode = null;
  }

  public close() {
    if (this.ctx) {
      this.ctx.close();
    }
  }
}

// Attach to window
(window as any).AudioEngine = AudioEngine;
