import * as React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * Human-readable failure block with optional retry. Use wherever an async
 * fetch can fail — audit log load, file listing, user list, etc.
 *
 * `onRetry` renders a Retry button. Override the label via `retryLabel`.
 * For non-retryable errors, pass custom children via `action` instead.
 */
export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: React.ReactNode
  onRetry?: () => void
  retryLabel?: string
  action?: React.ReactNode
  size?: 'sm' | 'md'
}

export const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  (
    {
      title = 'Something went wrong',
      description,
      onRetry,
      retryLabel = 'Retry',
      action,
      size = 'md',
      className,
      ...props
    },
    ref,
  ) => {
    const isSm = size === 'sm'
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'flex flex-col items-center justify-center text-center',
          isSm ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-10',
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-destructive/10 text-destructive',
            isSm ? 'size-8' : 'size-10',
          )}
        >
          <AlertCircle className={isSm ? 'size-4' : 'size-5'} aria-hidden="true" />
        </div>
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
        {(action || onRetry) && (
          <div className={cn('mt-1 flex items-center gap-2', isSm && 'mt-0.5')}>
            {onRetry && (
              <Button
                variant="outline"
                size={isSm ? 'sm' : 'default'}
                onClick={onRetry}
              >
                <RefreshCw />
                {retryLabel}
              </Button>
            )}
            {action}
          </div>
        )}
      </div>
    )
  },
)
ErrorState.displayName = 'ErrorState'
