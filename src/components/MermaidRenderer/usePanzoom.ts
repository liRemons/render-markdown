import { useRef, useEffect, RefObject } from "react";
import Panzoom from "@panzoom/panzoom";

interface PanzoomRefType {
  destroy: () => void;
  zoomWithWheel: (e: WheelEvent) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

interface UsePanzoomParams {
  contentRef: RefObject<HTMLElement | null>;
  wrapperRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  svg: string;
  isFullscreen: boolean;
}

export default function usePanzoom({ contentRef, wrapperRef, enabled, svg, isFullscreen }: UsePanzoomParams) {
  const panzoomRef = useRef<PanzoomRefType | null>(null);

  useEffect(() => {
    if (!enabled || !contentRef.current || !svg) {
      if (panzoomRef.current) {
        panzoomRef.current.destroy();
        panzoomRef.current = null;
      }
      return;
    }
    if (panzoomRef.current) {
      panzoomRef.current.destroy();
      panzoomRef.current = null;
    }
    const elem = contentRef.current;
    const panzoomInstance = Panzoom(elem, {
      maxScale: 5,
      minScale: 0.1,
      startScale: 1,
      contain: 'outside' as const,
    });
    panzoomRef.current = {
      destroy: () => panzoomInstance.destroy(),
      zoomWithWheel: panzoomInstance.zoomWithWheel,
      zoomIn: () => panzoomInstance.zoomIn(),
      zoomOut: () => panzoomInstance.zoomOut(),
      reset: () => panzoomInstance.reset(),
    };
    const wheelTarget = wrapperRef.current;
    const handleWheel = panzoomRef.current!.zoomWithWheel;
    wheelTarget?.addEventListener("wheel", handleWheel);
    return () => {
      wheelTarget?.removeEventListener("wheel", handleWheel);
      if (panzoomRef.current) {
        panzoomRef.current.destroy();
        panzoomRef.current = null;
      }
    };
  }, [svg, isFullscreen, enabled, contentRef, wrapperRef]);

  return panzoomRef;
}
