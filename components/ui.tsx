'use client';

import * as React from 'react';

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

const buttonVariants = {
  default: 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_1px_2px_rgba(15,23,42,.12)] hover:bg-[hsl(var(--primary)/.92)] focus-visible:ring-[hsl(var(--ring)/.35)]',
  secondary: 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] shadow-sm hover:bg-[hsl(var(--secondary)/.78)] focus-visible:ring-[hsl(var(--ring)/.25)]',
  outline: 'border border-[hsl(var(--border))] bg-[hsl(var(--background)/.78)] text-[hsl(var(--foreground))] shadow-sm hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]',
  ghost: 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]',
  destructive: 'bg-[hsl(var(--destructive))] text-white shadow-sm hover:bg-[hsl(var(--destructive)/.9)]',
  link: 'text-[hsl(var(--primary))] underline-offset-4 hover:underline',
} as const;

const buttonSizes = {
  default: 'h-9 px-4 py-2',
  sm: 'h-8 rounded-md px-3 text-xs',
  lg: 'h-10 rounded-md px-6',
  icon: 'h-9 w-9',
} as const;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 outline-none active:scale-[.99]',
        'focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] shadow-[0_1px_2px_rgba(15,23,42,.035),0_10px_30px_rgba(15,23,42,.025)]', className)} {...props} />
));
Card.displayName = 'Card';

export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />;
export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />;
export const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p className={cn('text-sm text-[hsl(var(--muted-foreground))]', className)} {...props} />;
export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('p-6 pt-0', className)} {...props} />;
export const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('flex items-center p-6 pt-0', className)} {...props} />;

const badgeVariants = {
  default: 'border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]',
  secondary: 'border-transparent bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]',
  outline: 'border-[hsl(var(--border))] text-[hsl(var(--foreground))]',
  success: 'border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  warning: 'border-transparent bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
} as const;

export function Badge({ children, className, variant = 'secondary', ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: keyof typeof badgeVariants }) {
  return <div className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors', badgeVariants[variant], className)} {...props}>{children}</div>;
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type = 'text', ...props }, ref) => (
  <input ref={ref} type={type} className={cn('flex h-9 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1 text-sm shadow-sm outline-none transition-colors placeholder:text-[hsl(var(--muted-foreground))] focus-visible:border-[hsl(var(--ring))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring)/.16)] disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />
));
Input.displayName = 'Input';

export const Separator = ({ className, orientation = 'horizontal', ...props }: React.HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }) => (
  <div role="separator" aria-orientation={orientation} className={cn('shrink-0 bg-[hsl(var(--border))]', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)} {...props} />
);
