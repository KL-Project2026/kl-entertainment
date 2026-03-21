import React, { useRef } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  wrapperClassName?: string;
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, wrapperClassName, value, onChange, min, max, disabled, placeholder, ...props }, ref) => {
    const internalRef = useRef<HTMLInputElement>(null);
    const inputRef = (ref as React.RefObject<HTMLInputElement>) ?? internalRef;

    const open = () => {
      if (disabled) return;
      try { (inputRef as React.RefObject<HTMLInputElement>).current?.showPicker(); } catch { /* fallback */ }
    };

    return (
      <div
        onClick={open}
        className={cn(
          "relative flex items-center gap-2 h-10 px-3 rounded-xl border border-white/10 bg-black/30",
          "cursor-pointer select-none transition-all",
          "hover:border-white/20 hover:bg-black/40",
          "focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/30",
          disabled && "opacity-50 cursor-not-allowed",
          wrapperClassName
        )}
      >
        <Calendar className="w-3.5 h-3.5 text-primary/70 shrink-0 pointer-events-none" />
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          disabled={disabled}
          placeholder={placeholder}
          {...props}
          className={cn(
            "flex-1 bg-transparent text-sm text-foreground focus:outline-none cursor-pointer min-w-0",
            "[color-scheme:dark]",
            className
          )}
          style={{ colorScheme: "dark" }}
        />
      </div>
    );
  }
);
DateInput.displayName = "DateInput";

interface MonthInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  wrapperClassName?: string;
}

export const MonthInput = React.forwardRef<HTMLInputElement, MonthInputProps>(
  ({ className, wrapperClassName, value, onChange, disabled, ...props }, ref) => {
    const internalRef = useRef<HTMLInputElement>(null);
    const inputRef = (ref as React.RefObject<HTMLInputElement>) ?? internalRef;

    const open = () => {
      if (disabled) return;
      try { (inputRef as React.RefObject<HTMLInputElement>).current?.showPicker(); } catch { /* fallback */ }
    };

    return (
      <div
        onClick={open}
        className={cn(
          "relative flex items-center gap-2 h-10 px-3 rounded-xl border border-white/10 bg-black/30",
          "cursor-pointer select-none transition-all",
          "hover:border-white/20 hover:bg-black/40",
          "focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/30",
          disabled && "opacity-50 cursor-not-allowed",
          wrapperClassName
        )}
      >
        <Calendar className="w-3.5 h-3.5 text-primary/70 shrink-0 pointer-events-none" />
        <input
          ref={inputRef}
          type="month"
          value={value}
          onChange={onChange}
          disabled={disabled}
          {...props}
          className={cn(
            "flex-1 bg-transparent text-sm text-foreground focus:outline-none cursor-pointer min-w-0",
            "[color-scheme:dark]",
            className
          )}
          style={{ colorScheme: "dark" }}
        />
      </div>
    );
  }
);
MonthInput.displayName = "MonthInput";
