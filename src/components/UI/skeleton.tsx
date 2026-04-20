import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Placeholder block with a subtle pulse. Compose many of these to shape
 * a skeleton that matches the eventual layout — prefer that over a spinner.
 *
 * Example:
 *   <div className="space-y-2">
 *     <Skeleton className="h-4 w-1/3" />
 *     <Skeleton className="h-4 w-2/3" />
 *   </div>
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}
