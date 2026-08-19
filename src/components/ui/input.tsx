import * as React from "react";
import { cn } from "@/lib/utils";

function useFocusedValue(
  value: string | number | readonly string[] | undefined,
  onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>,
) {
  const [focused, setFocused] = React.useState(false);
  const [inner, setInner] = React.useState(value ?? "");
  const controlled = value !== undefined;
  const shown = focused && controlled ? inner : value;

  function focus(current: string) {
    setFocused(true);
    setInner(current);
  }
  function change(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setInner(e.target.value);
    onChange?.(e);
  }
  function blur() {
    setFocused(false);
  }
  return { shown, focus, change, blur, controlled };
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, value, onChange, onFocus, onBlur, defaultValue, ...props }, ref) => {
  const lock = useFocusedValue(value, onChange as React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>);
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
      {...(lock.controlled && type !== "file" && type !== "checkbox" && type !== "radio"
        ? {
            value: lock.shown as string | number | readonly string[] | undefined,
            onChange: (e) => lock.change(e),
          }
        : { defaultValue, onChange })}
      onFocus={(e) => {
        if (type !== "file" && type !== "checkbox" && type !== "radio") lock.focus(e.target.value);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        lock.blur();
        onBlur?.(e);
      }}
    />
  );
});
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, value, onChange, onFocus, onBlur, defaultValue, ...props }, ref) => {
  const lock = useFocusedValue(value, onChange as React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>);
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
      {...(lock.controlled
        ? {
            value: String(lock.shown ?? ""),
            onChange: (e) => lock.change(e),
          }
        : { defaultValue, onChange })}
      onFocus={(e) => {
        lock.focus(e.target.value);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        lock.blur();
        onBlur?.(e);
      }}
    />
  );
});
Textarea.displayName = "Textarea";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-xs font-medium text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}
