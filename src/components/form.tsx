import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { BANK_PRESETS } from '../lib/banks';

export const COLORS = { primary: '#2f6f4f', danger: '#a33a3a', error: '#b3261e', border: '#8886' };

export function FormScreen({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

type InputProps = { label: string; error?: string; hint?: string } & TextInputProps;

export function Input({ label, error, hint, style, ...props }: InputProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      <TextInput style={[styles.input, error ? styles.inputError : null, style]} accessibilityLabel={label} placeholderTextColor="#8889" {...props} />
    </Field>
  );
}

export const MoneyInput = (props: InputProps) => <Input keyboardType="decimal-pad" placeholder="0,00" {...props} />;
export const DayInput = (props: InputProps) => <Input keyboardType="number-pad" maxLength={2} placeholder="1 a 31" {...props} />;
export const MonthInput = (props: InputProps) => <Input keyboardType="numbers-and-punctuation" maxLength={7} placeholder="mm/aaaa" {...props} />;
export const DateInput = (props: InputProps) => <Input keyboardType="numbers-and-punctuation" maxLength={10} placeholder="dd/mm/aaaa" {...props} />;

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

export function Chips<T extends string>({ label, options, value, onChange, error }: {
  label: string; options: ChipOption<T>[]; value: T | undefined; onChange: (value: T) => void; error?: string;
}) {
  return (
    <Field label={label} error={error}>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              style={[styles.chip, selected && styles.chipSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

const OTHER = 'Outro';

/** Bank chips with an "Outro" option that reveals a text field. */
export function BankPicker({ value, onChange, error }: { value: string; onChange: (bank: string) => void; error?: string }) {
  const isPreset = (BANK_PRESETS as readonly string[]).includes(value);
  const [other, setOther] = useState(!isPreset && value !== '');
  const options = [...BANK_PRESETS, OTHER].map((b) => ({ value: b, label: b }));
  return (
    <>
      <Chips
        label="Banco"
        options={options}
        value={other ? OTHER : isPreset ? value : undefined}
        onChange={(bank) => {
          setOther(bank === OTHER);
          onChange(bank === OTHER ? '' : bank);
        }}
        error={other ? undefined : error}
      />
      {other && <Input label="Nome do banco" value={value} onChangeText={onChange} error={error} autoFocus />}
    </>
  );
}

export function Button({ title, onPress, kind = 'primary', disabled }: {
  title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger'; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[styles.button, kind === 'primary' && styles.primary, kind === 'danger' && styles.danger, kind === 'secondary' && styles.secondary, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, kind === 'secondary' && styles.secondaryText]}>{title}</Text>
    </Pressable>
  );
}

/** Inline confirmation (no system alert dialogs). */
export function InlineConfirm({ message, confirmLabel, onConfirm, onCancel }: {
  message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <View style={styles.confirm} accessibilityLiveRegion="polite">
      <Text style={styles.confirmText}>{message}</Text>
      <Button title={confirmLabel} kind="danger" onPress={onConfirm} />
      <Button title="Cancelar" kind="secondary" onPress={onCancel} />
    </View>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text style={styles.error} accessibilityLiveRegion="assertive">
      {message}
    </Text>
  );
}

export const SAVE_ERROR = 'Não consegui salvar. Seus dados anteriores continuam guardados. Tente de novo.';

/** Runs a save; returns false and a calm message on failure instead of crashing. */
export async function trySave(action: () => Promise<void>, onError: (message: string) => void): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (error) {
    console.warn('[form] save failed', error);
    onError(SAVE_ERROR);
    return false;
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { padding: 16, gap: 14, paddingBottom: 48 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500' },
  hint: { fontSize: 12, opacity: 0.6 },
  error: { fontSize: 13, color: COLORS.error },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, minHeight: 44, fontSize: 16 },
  inputError: { borderColor: COLORS.error },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: COLORS.border },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 15 },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  button: { minHeight: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  primary: { backgroundColor: COLORS.primary },
  danger: { backgroundColor: COLORS.danger },
  secondary: { borderWidth: 1, borderColor: COLORS.border },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryText: { color: '#1f1f1f', fontWeight: '500' },
  confirm: { gap: 8, padding: 12, borderRadius: 12, backgroundColor: 'rgba(163,58,58,0.08)' },
  confirmText: { fontSize: 15 },
});
