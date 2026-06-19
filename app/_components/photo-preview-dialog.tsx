"use client";

import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PhotoPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoPath: string;
  originalPhotoPath: string | null;
  clientName: string;
}

export function PhotoPreviewDialog({
  open,
  onOpenChange,
  photoPath,
  originalPhotoPath,
  clientName,
}: PhotoPreviewDialogProps) {
  const displayPath = originalPhotoPath ?? photoPath;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{clientName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-full overflow-hidden rounded-md">
            <Image
              src={displayPath}
              alt={`${clientName} 的照片`}
              width={672}
              height={672}
              unoptimized
              className="h-auto w-full object-contain"
              priority
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
