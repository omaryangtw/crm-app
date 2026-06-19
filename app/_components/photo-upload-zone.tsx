"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { Camera, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/app/_components/confirm-dialog";
import { ImageCropper } from "@/app/_components/image-cropper";
import { validatePhotoFile } from "@/app/_lib/utils/photo-validation";
import {
  uploadPhoto,
  deletePhoto,
} from "@/app/_lib/actions/photo-actions";

interface PhotoUploadZoneProps {
  clientId: number;
  /** Existing photos sorted by version desc */
  photos: {
    id: number;
    photoPath: string;
    originalPhotoPath: string;
    version: number;
  }[];
  /** Callback after successful upload */
  onUploadSuccess?: () => void;
}

export function PhotoUploadZone({
  clientId,
  photos,
  onUploadSuccess,
}: PhotoUploadZoneProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  // Cropper state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);

  // Delete confirm state
  const [deleteOpen, setDeleteOpen] = useState(false);

  const activePhoto = photos.length > 0 ? photos[0] : null;

  function handleFileSelect(file: File) {
    const result = validatePhotoFile(file);
    if (!result.valid) {
      toast.error(result.error);
      return;
    }
    // Store original file and open cropper
    setOriginalFile(file);
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    // Reset input so the same file can be selected again
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handleCropComplete(croppedBlob: Blob) {
    // Clean up object URL
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);

    if (!originalFile) return;

    const formData = new FormData();
    formData.set("clientId", String(clientId));
    formData.set(
      "thumbnail",
      new File([croppedBlob], "thumbnail.jpg", { type: "image/jpeg" })
    );
    formData.set("original", originalFile);

    startTransition(async () => {
      const result = await uploadPhoto(formData);
      setOriginalFile(null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      router.refresh();
      onUploadSuccess?.();
    });
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setOriginalFile(null);
  }

  function handleDeleteConfirm() {
    if (!activePhoto) return;
    startDelete(async () => {
      const result = await deletePhoto(activePhoto.id);
      setDeleteOpen(false);
      if (!result.success) {
        toast.error(result.error ?? "刪除失敗");
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      {activePhoto ? (
        /* ── Has photo: show thumbnail + action buttons ── */
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
            <Image
              src={activePhoto.photoPath}
              alt="族人照片"
              width={96}
              height={96}
              unoptimized
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus className="mr-1 h-4 w-4" />
              {isPending ? "上傳中..." : "新增照片"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              刪除照片
            </Button>
          </div>
        </div>
      ) : (
        /* ── No photo: show drop zone ── */
        <div
          role="button"
          tabIndex={0}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/50 p-8 text-muted-foreground transition-colors hover:bg-muted"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <Camera className="h-8 w-8" />
          <p className="text-sm">
            {isPending ? "上傳中..." : "點擊或拖放照片至此"}
          </p>
          <p className="text-xs">支援 JPEG、PNG、WebP（≤5MB）</p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Image Cropper Dialog */}
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="刪除照片"
        description="確定要刪除此版本的照片嗎？此操作無法復原。"
        confirmLabel="刪除"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        loading={isDeleting}
      />
    </>
  );
}
