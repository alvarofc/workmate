import * as React from "react";
import { cn } from "../../lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, type = "text", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            className={cn(
              "w-full h-10 px-3 bg-surface-raised border border-border rounded-lg",
              "text-text-primary placeholder:text-text-muted",
              "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent",
              "transition-all duration-200",
              icon && "pl-10",
              error && "border-error focus:ring-error",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <span className="text-sm text-error">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
