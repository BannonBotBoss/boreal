/** Original synthesized placeholder sounds; no external audio files. */
export const soundLibrary = {
  'stone-roll': { title: 'Stone roll', purpose: 'Snout pushes stone', source: 'original synthesis', frequencies: [85, 110, 65, 90] },
  'friend-chime': { title: 'Friendship', purpose: 'Successful speech', source: 'original synthesis', frequencies: [440, 554, 659] },
  'gather-rustle': { title: 'Gather', purpose: 'Resource collected', source: 'original synthesis', frequencies: [240, 180] },
};
export class AudioLibrary {
  private context?: AudioContext;
  enabled = false;
  async enable() { this.context ??= new AudioContext(); await this.context.resume(); this.enabled = true; }
  play(id: keyof typeof soundLibrary) {
    if (!this.enabled || !this.context) return;
    const context = this.context;
    soundLibrary[id].frequencies.forEach((frequency, i) => {
      const oscillator = context.createOscillator(), gain = context.createGain(), start = context.currentTime + i * .07;
      oscillator.frequency.value = frequency; oscillator.type = 'sine';
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.055, start + .015); gain.gain.exponentialRampToValueAtTime(.001, start + .25);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(start); oscillator.stop(start + .3);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }
}
