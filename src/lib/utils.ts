import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Conditionally join Tailwind class names and deduplicate conflicts.
 * Standard shadcn/ui helper — every component in `src/components/ui/`
 * imports this as `cn`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
