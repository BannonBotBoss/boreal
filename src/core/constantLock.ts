/**
 * Locked base constants. Locked (the default) means the CODATA/IAU value is always used. A base constant becomes
 * adjustable when its control badge (core/badges.ts, `constant.<name>`) is held. G is first and is the capstone badge.
 */
import { setBase, resetBase } from './constants';
import { canUse } from './badges';
export const isUnlocked = (name: string) => canUse(`constant.${name}`);
export const setConstant = (name: string, v: number) => setBase(name, v, isUnlocked);
export const resetConstant = (name?: string) => resetBase(name);
