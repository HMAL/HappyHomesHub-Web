import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import SignaturePadLib from 'signature_pad';

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  clear: () => void;
  toDataURL: (type?: string) => string;
  toBlob: (callback: (blob: Blob | null) => void, type?: string) => void;
}

interface Props {
  penColor?: string;
  className?: string;
}

const SignaturePad = forwardRef<SignaturePadHandle, Props>(
  ({ penColor = '#0D1F2D', className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePadLib | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(ratio, ratio);
      padRef.current = new SignaturePadLib(canvas, { penColor });
      return () => {
        padRef.current?.off();
        padRef.current = null;
      };
    }, [penColor]);

    useImperativeHandle(ref, () => ({
      isEmpty: () => padRef.current?.isEmpty() ?? true,
      clear: () => padRef.current?.clear(),
      toDataURL: (type = 'image/png') => padRef.current?.toDataURL(type) ?? '',
      toBlob: (cb, type = 'image/png') => {
        if (!padRef.current) { cb(null); return; }
        const dataUrl = padRef.current.toDataURL(type);
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)![1];
        const bstr = atob(arr[1]);
        const n = bstr.length;
        const u8arr = new Uint8Array(n);
        for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
        cb(new Blob([u8arr], { type: mime }));
      },
    }));

    return (
      <canvas
        ref={canvasRef}
        className={
          className ??
          'w-full h-40 border-2 border-dashed border-gray-300 rounded-xl bg-white cursor-crosshair'
        }
        style={{ touchAction: 'none' }}
      />
    );
  },
);

SignaturePad.displayName = 'SignaturePad';
export default SignaturePad;
