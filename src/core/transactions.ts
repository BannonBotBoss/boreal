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
  /** Several rows can share a pair (wolf|hare pin, bite, hold, consume, release). Absent = the pair's only row. */
  verb?: string;
  run(args: A): number;
}
const rowKey = (a: string, b: string, verb?: string) => { const p = pairKey(a, b); return verb ? `${p}#${verb}` : p; };
export function createTransactions() {
  const rows = new Map<string, TransactionRow<any>>();
  return {
    add<A>(row: TransactionRow<A>) { rows.set(rowKey(row.a, row.b, row.verb), row); return row; },
    get: (a: string, b: string, verb?: string) => rows.get(rowKey(a, b, verb)),
    has: (a: string, b: string, verb?: string) => rows.has(rowKey(a, b, verb)),
    /** Run the row for two entity keys; 0 if there is no row, or it needs a contact the bus does not have.
     *  `verb` selects one row when the pair has several. Omit it for the pair's original row. */
    run<A>(keyA: string, keyB: string, args: A, verb?: string): number {
      const row = rows.get(rowKey(kindOf(keyA), kindOf(keyB), verb)); if (!row) return 0;
      if (row.needsContact && CONTACTS.touching(keyA, keyB).length === 0) return 0;
      return row.run(args);
    },
    list: () => [...rows.values()],
  };
}
export const TRANSACTIONS = createTransactions();