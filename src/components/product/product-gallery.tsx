import Image from "next/image";

export function ProductGallery({
  images,
  alt,
}: {
  images: { url: string }[];
  alt: string;
}) {
  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-2xl border bg-muted text-sm text-muted-foreground">
        暂无图片
      </div>
    );
  }

  return (
    <div>
      {/* 移动端：横向滑动看全部图片，不展示缩略图 */}
      <div className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl border bg-muted [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
        {images.map((image, index) => (
          <div
            key={image.url}
            className="relative aspect-[4/5] w-full shrink-0 snap-center"
          >
            <Image
              src={image.url}
              alt={`${alt} 图 ${index + 1}`}
              fill
              sizes="100vw"
              className="object-contain"
              priority={index === 0}
            />
          </div>
        ))}
      </div>

      {/* 桌面端：只展示主图，不再展示小图 */}
      <div className="relative hidden aspect-[4/5] overflow-hidden rounded-2xl border bg-muted lg:block">
        <Image
          src={images[0].url}
          alt={alt}
          fill
          sizes="(max-width: 1280px) 50vw, 560px"
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
}
