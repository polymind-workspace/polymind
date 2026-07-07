import { cn } from "@/lib/utils"

interface Banner {
  id: string
  title: string
  subtitle: string
  imageUrl?: string
  cta?: string
}

interface BannerCarouselProps {
  banners: Banner[]
  className?: string
}

export function BannerCarousel({ banners, className }: BannerCarouselProps) {
  return (
    <div className={cn("w-full overflow-x-auto pb-2", className)}>
      <div className="flex snap-x snap-mandatory gap-4 px-1">
        {banners.map((banner) => (
          <div
            key={banner.id}
            className="relative min-w-[85%] snap-start overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 p-5 ring-1 ring-border sm:min-w-[420px]"
          >
            {banner.imageUrl && (
              <img
                src={banner.imageUrl}
                alt=""
                className="absolute right-0 top-0 h-full w-1/2 object-cover opacity-20"
              />
            )}
            <div className="relative z-10 max-w-[70%]">
              <h3 className="text-lg font-semibold">{banner.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{banner.subtitle}</p>
              {banner.cta && (
                <span className="mt-3 inline-block text-sm font-medium text-primary">
                  {banner.cta} →
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
