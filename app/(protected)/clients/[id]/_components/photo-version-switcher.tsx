"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoPreviewDialog } from "@/app/_components/photo-preview-dialog";

interface PhotoVersionSwitcherProps {
  photos: {
    id: number;
    photoPath: string;
    originalPhotoPath: string;
    version: number;
    createdAt: Date;
  }[];
  clientName: string;
}

export function PhotoVersionSwitcher({
  photos,
  clientName,
}: PhotoVersionSwitcherProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (photos.length === 0) return null;

  const current = photos[currentIndex];
  const total = photos.length;
  const hasMultiple = total > 1;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setPreviewOpen(true)}
        aria-label={`檢視 ${clientName} 的照片`}
      >
        <Image
          src={current.photoPath}
          alt={`${clientName} 的照片`}
          width={96}
          height={96}
          unoptimized
          className="rounded-full object-cover"
          style={{ width: 96, height: 96 }}
        />
      </button>

      {hasMultiple && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => i - 1)}
            aria-label="上一版本"
          >
            <ChevronLeft />
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {total}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={currentIndex === total - 1}
            onClick={() => setCurrentIndex((i) => i + 1)}
            aria-label="下一版本"
          >
            <ChevronRight />
          </Button>
        </div>
      )}

      <PhotoPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        photoPath={current.photoPath}
        originalPhotoPath={current.originalPhotoPath}
        clientName={clientName}
      />
    </div>
  );
}
