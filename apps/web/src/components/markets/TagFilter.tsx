import { cn } from "@/lib/utils"

interface TagFilterProps {
  tags: string[]
  active: string
  onSelect: (tag: string) => void
  className?: string
}

export function TagFilter({ tags, active, onSelect, className }: TagFilterProps) {
  return (
    <div className={cn("relative flex items-center", className)}>
      <div className="flex w-full gap-2 overflow-x-auto px-1 py-1 scrollbar-hide">
        {tags.map((tag) => (
          <button
            key={tag}
            onClick={() => onSelect(tag)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              active === tag
                ? "bg-secondary text-secondary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {tag}
          </button>
        ))}
      </div>
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent" />
    </div>
  )
}
