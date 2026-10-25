/**
 * The transaction registry (Grok Bot, T-0009): ONE table of what happens when two kinds of thing meet, keyed by the kind pair
 * (order-free, like CONTACTS pairs). A row is data plus one pure effect; systems never hard-code "a hare eats clover" in their
 * own update loops, they ask the registry. Kinds come from entity keys ('hare:3' -> 'hare', 'clover:-6:1:2:1' -> 'clover');
 * 'sun' is the sunlight on the ground.
 *  - Contact rows (eater | food) run only while CONTACTS has that pair (the feed contact the agent pipeline begins/ends).
 *  - Field rows (clover | sun) run lazily over an interval of world seconds when someone reads the object.
 */
import { CONTACTS, pairKey } from './contactBus';

export const kindOf = (key: string) => { const i = key.indexOf(':'); return i < 0 ? key : key.slice(0, i); };
export interface TransactionRow<A = unknown> {
  a: string; b: string; name: string; /** where the numbers come from */ source: string;
  /** true: only while CONTACTS has the (a, b) entity pair */ needsContact: boolean;
  run(args: A): number;
}
export function createTransactions() {
  const rows = new Map<string, TransactionRow<any>>();
  return {
    add<A>(row: TransactionRow<A>) { rows.set(pairKey(row.a, row.b), row); return row; },
    get: (a: string, b: string) => rows.get(pairKey(a, b)),
    has: (a: string, b: string) => rows.has(pairKey(a, b)),
    /** Run the row for two entity keys; 0 if there is no row, or it needs a contact the bus does not have. */
    run<A>(keyA: string, keyB: string, args: A): number {
      const row = rows.get(pairKey(kindOf(keyA), kindOf(keyB))); if (!row) return 0;
      if (row.needsContact && CONTACTS.touching(keyA, keyB).length === 0) return 0;
      return row.run(args);
    },
    list: () => [...rows.values()],
  };
}
export const TRANSACTIONS = createTransactions();