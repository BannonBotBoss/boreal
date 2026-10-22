/** Mutable, widened copy of a SYSTEM_PROPERTIES group, for modules whose runtime object is changed by settings (FEEL, GOVERNOR ...). */
export type Widen<T> = T extends number ? number : T extends string ? string : T extends boolean ? boolean
  : T extends readonly (infer U)[] ? Widen<U>[] : T extends object ? { -readonly [K in keyof T]: Widen<T[K]> } : T;
export const live = <T>(group: T): Widen<T> => structuredClone(group) as Widen<T>;
