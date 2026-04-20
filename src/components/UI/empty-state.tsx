import * as React from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Standardized empty-state block for any panel with a "no data yet" path.
 *
 * Layout: centered column → muted icon → title → description → action slot.
 * Sizes: `sm` for inline/sidebar panes, `md` for main panel bodies.
 */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  size?: 'sm' | 'md'
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon: Icon, title, description, action, size = 'md', className, ...props }, ref) => {
    const isSm = size === 'sm'
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center text-center',
          isSm ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-10',
          className,
        )}
        {...props}
      >
        {Icon && (
          <div
            className={cn(
              'flex items-center justify-center rounded-full bg-muted text-muted-foreground',
              isSm ? 'size-8' : 'size-10',
            )}
          >
            <Icon className={isSm ? 'size-4' : 'size-5'} aria-hidden="true" />
          </div>
        )}
        <div className={cn('flex flex-col', isSm ? 'gap-0.5' : 'gap-1')}>
          <div
            className={cn(
              'font-semibold text-foreground',
              isSm ? 'text-sm' : 'text-base',
            )}
          >
            {title}
          </div>
          {description && (
            <div
              className={cn(
                'text-muted-foreground',
                isSm ? 'text-xs' : 'text-sm',
              )}
            >
              {description}
            </div>
          )}
        </div>
        {action && <div className={cn('mt-1', isSm && 'mt-0.5')}>{action}</div>}
      </div>
    )
  },
)
EmptyState.displayName = 'EmptyState'
