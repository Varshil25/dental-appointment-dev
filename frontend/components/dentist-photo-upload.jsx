'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/use-toast';
import { initials } from '@/lib/initials';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Camera, Trash2, RotateCw } from 'lucide-react';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

function validate(file) {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Only JPG, PNG, or WEBP images are allowed';
  if (file.size > MAX_BYTES) return 'Image is too large — max 5MB';
  return null;
}

// Photo upload control for a dentist's profile — file picker, local preview
// before/during upload, progress, and remove/replace. Only usable once a
// dentist already has an id (POST /api/dentists/:id/photo is id-keyed), so
// this only appears on the edit page (pages/dentists/detail.jsx), not the
// "Add dentist" create dialog.
export function DentistPhotoUpload({ dentist, onChanged }) {
  const notify = useToast();
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null); // local object URL, shown while uploading/retrying
  const [pendingFile, setPendingFile] = useState(null); // kept only so Retry can resend without re-picking
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState(null);

  async function upload(file) {
    setUploading(true);
    setProgress(0);
    setError(null);
    try {
      const updated = await api.uploadDentistPhoto(dentist.id, file, setProgress);
      onChanged(updated);
      notify('Photo updated');
      setPreview(null);
      setPendingFile(null);
    } catch (e) {
      // Keep preview + pendingFile on failure so the Retry button below can
      // resend the same file without the admin re-picking it.
      setError(e.message);
      notify(e.message, 'err');
    } finally {
      setUploading(false);
    }
  }

  function pick(file) {
    const err = validate(file);
    if (err) {
      notify(err, 'err');
      return;
    }
    setError(null);
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
    upload(file);
  }

  async function remove() {
    setRemoving(true);
    try {
      const updated = await api.removeDentistPhoto(dentist.id);
      onChanged(updated);
      notify('Photo removed');
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setRemoving(false);
    }
  }

  const displaySrc = preview || dentist.photo_url || undefined;

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar size="lg" className="size-16">
          <AvatarImage src={displaySrc} alt={dentist.name} />
          <AvatarFallback className="text-base">{initials(dentist.name)}</AvatarFallback>
        </Avatar>
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
            <Spinner />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={uploading || removing} onClick={() => inputRef.current?.click()}>
            <Camera /> {dentist.photo_url ? 'Replace photo' : 'Upload photo'}
          </Button>
          {dentist.photo_url && (
            <Button type="button" variant="ghost" size="sm" disabled={uploading || removing} onClick={remove}>
              {removing ? <Spinner /> : <Trash2 />} Remove
            </Button>
          )}
        </div>

        {uploading && <p className="text-xs text-muted-foreground">Uploading… {progress}%</p>}

        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <span>{error}</span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => pendingFile && upload(pendingFile)}
            >
              <RotateCw className="size-3" /> Retry
            </Button>
          </div>
        )}

        {!error && !uploading && <p className="text-xs text-muted-foreground">JPG, PNG or WEBP, up to 5MB.</p>}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) pick(file);
            e.target.value = ''; // lets picking the same file again re-fire onChange
          }}
        />
      </div>
    </div>
  );
}
