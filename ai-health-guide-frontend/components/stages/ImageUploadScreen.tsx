"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

interface ImageUploadScreenProps {
  sessionId: string;
  onUploaded: () => void;
  onSkip: () => void;
}

export const ImageUploadScreen = ({
  sessionId,
  onUploaded,
  onSkip,
}: ImageUploadScreenProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    setError(null);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const upload = async () => {
    const file = inputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(`/api/sessions/${sessionId}/image`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      onUploaded();
    } catch (err) {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 pt-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <p className="font-semibold text-gray-700">Optional: Upload an image</p>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            If your concern is visible (e.g., a rash, wound, or swelling), you
            can upload a photo. This is optional.
          </p>

          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 hover:bg-gray-100"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Preview"
                className="max-h-48 rounded-lg object-contain"
              />
            ) : (
              <p className="text-sm text-gray-400">
                Click or drag an image here
              </p>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={upload}
              isLoading={uploading}
              disabled={!preview}
              className="flex-1"
            >
              Upload image
            </Button>
            <Button variant="ghost" onClick={onSkip} className="flex-1">
              Skip
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
