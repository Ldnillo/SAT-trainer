"use client";

/** Grid-in answers allow only digits, a decimal point, a minus sign and a slash. */
export function cleanGridIn(value: string): string {
  return value.replace(/[^0-9./-]/g, "");
}

export function GridInInput(props: {
  name?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  autoFocus?: boolean;
}) {
  const { onValueChange, value, ...rest } = props;
  return (
    <input
      type="text"
      autoComplete="off"
      inputMode="text"
      maxLength={10}
      pattern="[0-9.\/\-]*"
      {...rest}
      {...(value !== undefined ? { value } : {})}
      onChange={(e) => {
        const cleaned = cleanGridIn(e.target.value);
        if (cleaned !== e.target.value) e.target.value = cleaned;
        onValueChange?.(cleaned);
      }}
    />
  );
}
