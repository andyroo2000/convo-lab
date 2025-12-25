import { useState, useCallback, useEffect } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { X } from 'lucide-react';

interface AvatarCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onSave: (croppedImageBlob: Blob, cropArea: Area) => Promise<void>;
  title?: string;
}

/**
 * Creates a cropped image blob from the original image and crop area
 */
async function getCroppedImage(imageSrc: string, cropArea: Area): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;

  await new Promise((resolve) => {
    image.onload = resolve;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Set canvas size to desired output size (256x256)
  canvas.width = 256;
  canvas.height = 256;

  // Draw the cropped area scaled down to 256x256
  ctx.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, 256, 256);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.85
    );
  });
}

const AvatarCropperModal = ({
  isOpen,
  onClose,
  imageUrl,
  onSave,
  title = 'Crop Avatar',
}: AvatarCropperModalProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Fetch image and create blob URL
  useEffect(() => {
    if (!isOpen || !imageUrl) return undefined;

    const fetchImage = async () => {
      try {
        // eslint-disable-next-line no-console
        console.log('Fetching image from:', imageUrl);
        // Only send credentials for same-origin requests (not for GCS URLs)
        const isGCSUrl = imageUrl.includes('storage.googleapis.com');
        // eslint-disable-next-line no-console
        console.log('Is GCS URL:', isGCSUrl);
        const response = await fetch(imageUrl, {
          credentials: isGCSUrl ? 'omit' : 'include',
        });
        // eslint-disable-next-line no-console
        console.log('Response status:', response.status);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();
        // eslint-disable-next-line no-console
        console.log('Blob created, size:', blob.size);
        const url = URL.createObjectURL(blob);
        // eslint-disable-next-line no-console
        console.log('Blob URL created:', url);
        setBlobUrl(url);
      } catch (error) {
        console.error('Failed to load image:', error);
        // eslint-disable-next-line no-alert
        alert(
          `Failed to load image. Please try again. Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    };

    fetchImage();

    // Cleanup blob URL when component unmounts or image changes
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [isOpen, imageUrl]);

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels || !blobUrl) return;

    setIsSaving(true);
    try {
      const croppedBlob = await getCroppedImage(blobUrl, croppedAreaPixels);
      await onSave(croppedBlob, croppedAreaPixels);
      onClose();
    } catch (error) {
      console.error('Failed to crop image:', error);
      // eslint-disable-next-line no-alert
      alert('Failed to crop image. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-navy">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSaving}
          >
            <X size={24} />
          </button>
        </div>

        {/* Cropper */}
        <div className="relative h-96 bg-gray-100">
          {blobUrl ? (
            <Cropper
              image={blobUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Loading image...</p>
            </div>
          )}
        </div>

        {/* Zoom Slider */}
        <div className="px-6 py-4 border-b">
          <label htmlFor="zoom-slider" className="block text-sm font-medium text-gray-700 mb-2">
            Zoom
            <input
              id="zoom-slider"
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full mt-2 block"
              disabled={isSaving}
            />
          </label>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSaving || !croppedAreaPixels}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvatarCropperModal;
