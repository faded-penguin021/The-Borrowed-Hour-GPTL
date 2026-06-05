import { usePassphrase } from "../context/PassphraseContext";
import { BTN_SETTINGS } from "../components/ui/styleClasses";

/**
 * System-tab control for the session key. Shows whether keys are currently
 * unlocked and offers a manual "lock now". Auto-lock also fires when the tab is
 * backgrounded (see src/security/autoLock.ts), so this is mostly for a reader
 * who wants to drop the key before stepping away on the same screen.
 */
export function KeyLockRow() {
  const { unlocked, clearSessionKey } = usePassphrase();
  return (
    <div className="block px-4 py-3 border border-cream/10 bg-[#1c162c]/40 cursor-default text-left w-full">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="font-display font-medium text-cream-bright tracking-[0.18em] text-[11px] uppercase">
            Locked keys
          </div>
          <div className="font-body italic text-cream-dim text-[12px] mt-1">
            {unlocked
              ? "Unlocked — your passphrase has derived a session key, so saved keys decrypt without re-prompting."
              : "Locked — your next provider call will ask for the passphrase again."}
          </div>
        </div>
        <button className={BTN_SETTINGS} onClick={clearSessionKey} disabled={!unlocked}>
          LOCK KEYS NOW
        </button>
      </div>
      <div className="font-body italic text-cream-faint text-[11px] mt-2 leading-normal">
        Encryption protects your keys at rest, not against code running on the page. Locking drops the in-memory key; backgrounding the tab locks it automatically.
      </div>
    </div>
  );
}
