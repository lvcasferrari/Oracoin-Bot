import { useState } from 'react';
import type { Result } from '../screens/forms/mappers';
import { trySave } from './form';

/** Draft state, per-field errors, a calm save error and a busy flag, shared by every form. */
export function useForm<D extends object, T>(initial: () => D, validate: (draft: D) => Result<T>) {
  const [draft, setDraft] = useState<D>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const set =
    <K extends keyof D>(key: K) =>
    (value: D[K]) => {
      setDraft((d) => ({ ...d, [key]: value }));
      setErrors((e) => {
        if (!(String(key) in e)) return e;
        const next = { ...e };
        delete next[String(key)];
        return next;
      });
    };

  /** Validates, then saves; on a failed save the draft stays and a calm message shows. */
  const submit = async (save: (value: T) => Promise<void>) => {
    const result = validate(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setBusy(true);
    setFormError(undefined);
    await trySave(() => save(result.value), setFormError);
    setBusy(false);
  };

  return { draft, setDraft, set, errors, formError, busy, submit };
}
