import type { ReactNode } from "react";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  onClick?: () => void;
}

export function Button({ variant = "primary", size = "md", children, onClick }: ButtonProps) {
  return (
    <button type="button" className={`btn btn-${variant} btn-${size}`} onClick={onClick}>
      {children}
    </button>
  );
}
