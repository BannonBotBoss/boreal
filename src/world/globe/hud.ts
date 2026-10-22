// T-0039: the game HUD (title, status card, interaction prompt, footer hint and buttons) is hidden while the in-page globe
// or the band is on screen and comes back in game mode (landing). Only the footer Menu button (and Esc) stays.
import type { TransitionMode } from './transition';

export const GLOBE_HUD_CLASS = 'on-globe';
export const hudHidden = (m: TransitionMode) => m !== 'game';