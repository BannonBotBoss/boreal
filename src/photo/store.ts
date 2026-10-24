/** Photo gallery in IndexedDB ('boreal.photos', store 'photos'): PNG blob (+ optional EXR), thumbnail, metadata. */
export interface PhotoMeta { takenWall: string; gameTime: string; view: string; location: string; N: number; t: number; iso: number; nd: number; focalMm: number; ev100: number; auto: boolean; filter: string; seed: number }
export interface Photo { id?: number; png: Blob; exr?: Blob; thumb: string; meta: PhotoMeta }
const open = () => new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('boreal.photos', 1); r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id', autoIncrement: true }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const tx = async <T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>) => { const db = await open(); return new Promise<T>((res, rej) => { const r = f(db.transaction('photos', mode).objectStore('photos')); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); };
export const addPhoto = (p: Photo) => tx('readwrite', s => s.add(p)) as Promise<number>;
export const listPhotos = () => tx('readonly', s => s.getAll()) as Promise<Photo[]>;
export const deletePhoto = (id: number) => tx('readwrite', s => s.delete(id));
