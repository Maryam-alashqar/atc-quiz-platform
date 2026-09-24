import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 select-none'
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-deep shadow-card',
  secondary: 'bg-surface text-primary ring-1 ring-line hover:bg-sky-soft',
  ghost: 'text-primary hover:bg-sky-soft',
  danger: 'bg-danger text-white hover:brightness-95',
}
// Minimum 44px touch target on every size.
const sizes: Record<Size, string> = {
  md: 'min-h-11 px-5 text-sm',
  lg: 'min-h-13 px-7 text-base',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({ variant, size, className = '', type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant
  size?: Size
}

export function ButtonLink({ variant, size, className = '', ...rest }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />
}
