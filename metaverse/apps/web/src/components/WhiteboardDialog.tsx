import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CaptureUpdateAction,
  Excalidraw,
  getSceneVersion,
} from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/excalidraw/element/types";
import "@excalidraw/excalidraw/index.css";

const PUBLISH_DELAY_MS = 100;

function asExcalidrawElements(
  elements: readonly unknown[],
): readonly ExcalidrawElement[] {
  return elements as readonly ExcalidrawElement[];
}

export default function WhiteboardDialog({
  teacherName,
  isTeacher,
  elements,
  sceneVersion,
  onElementsChange,
  onClose,
}: {
  teacherName: string;
  isTeacher: boolean;
  elements: readonly unknown[];
  sceneVersion: number;
  onElementsChange: (elements: readonly unknown[]) => void;
  onClose: () => void;
}) {
  const [excalidrawApi, setExcalidrawApi] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const appliedSceneVersionRef = useRef(sceneVersion);
  const lastPublishedVersionRef = useRef(
    getSceneVersion(asExcalidrawElements(elements)),
  );
  const publishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingElementsRef = useRef<readonly unknown[] | null>(null);
  const pendingVersionRef = useRef<number | null>(null);

  const initialData = useMemo(
    () => ({
      elements: asExcalidrawElements(elements),
      appState: {
        viewBackgroundColor: "#fbfaf7",
      },
      scrollToContent: elements.length > 0,
    }),
    [],
  );

  const publishPending = useCallback(() => {
    if (!pendingElementsRef.current || pendingVersionRef.current === null) {
      return;
    }
    lastPublishedVersionRef.current = pendingVersionRef.current;
    onElementsChange(pendingElementsRef.current);
    pendingElementsRef.current = null;
    pendingVersionRef.current = null;
  }, [onElementsChange]);

  const handleChange = useCallback(
    (nextElements: readonly OrderedExcalidrawElement[]) => {
      if (!isTeacher) return;
      const nextVersion = getSceneVersion(nextElements);
      if (nextVersion === lastPublishedVersionRef.current) return;

      pendingElementsRef.current = Array.from(nextElements);
      pendingVersionRef.current = nextVersion;
      if (publishTimerRef.current) clearTimeout(publishTimerRef.current);
      publishTimerRef.current = setTimeout(() => {
        publishTimerRef.current = null;
        publishPending();
      }, PUBLISH_DELAY_MS);
    },
    [isTeacher, publishPending],
  );

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!excalidrawApi || appliedSceneVersionRef.current === sceneVersion) {
      return;
    }

    const incomingElements = asExcalidrawElements(elements);
    appliedSceneVersionRef.current = sceneVersion;
    lastPublishedVersionRef.current = getSceneVersion(incomingElements);
    excalidrawApi.updateScene({
      elements: incomingElements,
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, [elements, excalidrawApi, sceneVersion]);

  useEffect(
    () => () => {
      if (publishTimerRef.current) clearTimeout(publishTimerRef.current);
      publishPending();
    },
    [publishPending],
  );

  const teacherInitial = teacherName.trim().charAt(0).toUpperCase() || "T";

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-[#070814e6] p-3 backdrop-blur-sm motion-safe:animate-[backdrop-in_160ms_ease-out_both] max-[760px]:p-0"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="flex h-[min(90dvh,900px)] w-full max-w-[1320px] min-w-0 flex-col overflow-hidden rounded-2xl border border-line-strong bg-[#f8f7f3] shadow-[0_26px_80px_#000b] motion-safe:animate-[dialog-in_220ms_var(--ease-out-snappy)_both] max-[760px]:h-dvh max-[760px]:max-h-none max-[760px]:rounded-none max-[760px]:border-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby="whiteboard-title"
      >
        <header className="flex min-w-0 items-center justify-between gap-4 border-b border-[#d8d4cc] bg-white px-5 py-3.5 max-[600px]:px-3 max-[600px]:py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="grid h-10 w-10 shrink-0 grid-cols-3 items-end gap-0.5 rounded-lg bg-[#22263d] p-2 max-[430px]:hidden"
              aria-hidden="true"
            >
              <span className="h-3 rounded-sm bg-[#f0c84b]" />
              <span className="h-5 rounded-sm bg-[#78d1ad]" />
              <span className="h-4 rounded-sm bg-[#899cf2]" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h2
                  id="whiteboard-title"
                  className="truncate font-pixel text-[0.72rem] leading-relaxed text-[#242638] sm:text-[0.8rem]"
                >
                  Classroom whiteboard
                </h2>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-wide ${
                    isTeacher
                      ? "border-[#8d6f16] bg-[#fff5c7] text-[#705500]"
                      : "border-[#b9bbc8] bg-[#f1f1f5] text-[#626474]"
                  }`}
                >
                  {isTeacher ? "Editing" : "View only"}
                </span>
              </div>
              <p className="mt-1 flex min-w-0 items-center gap-1 text-[0.7rem] text-[#6e7080] max-[500px]:hidden sm:text-xs">
                <span
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#5966b7] text-[0.58rem] font-bold text-white"
                  aria-hidden="true"
                >
                  {teacherInitial}
                </span>
                <strong className="max-w-36 truncate text-[#343647]">
                  {teacherName}
                </strong>{" "}
                is the teacher
                <span aria-hidden="true"> · </span>
                {isTeacher
                  ? "your work syncs live with the class"
                  : "their work appears here live"}
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#c9c7c1] bg-white text-2xl leading-none text-[#4c4e5d] transition-[background-color,border-color,transform] hover:border-[#a9a6a0] hover:bg-[#f1f0ec] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5966b7]"
            onClick={onClose}
            aria-label="Close whiteboard"
            title="Close (Esc)"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="whiteboard-canvas relative min-h-0 flex-1 overflow-hidden bg-[#fbfaf7]">
          <Excalidraw
            excalidrawAPI={setExcalidrawApi}
            initialData={initialData}
            onChange={isTeacher ? handleChange : undefined}
            viewModeEnabled={!isTeacher}
            autoFocus={false}
            detectScroll={false}
            handleKeyboardGlobally={false}
            aiEnabled={false}
            name="Classroom whiteboard"
            UIOptions={{
              canvasActions: {
                changeViewBackgroundColor: false,
                loadScene: false,
                saveToActiveFile: false,
                toggleTheme: false,
              },
              tools: { image: false },
            }}
          />
          {!isTeacher && elements.length === 0 && (
            <div
              className="pointer-events-none absolute inset-0 z-[2] grid place-content-center justify-items-center gap-2 p-6 text-center text-[#676979]"
              aria-live="polite"
            >
              <span
                className="grid h-12 w-12 place-items-center rounded-full border border-[#d4d1ca] bg-white text-2xl shadow-sm"
                aria-hidden="true"
              >
                ✎
              </span>
              <strong className="text-[#343647]">The board is ready</strong>
              <span className="max-w-sm text-sm">
                Waiting for {teacherName} to start the lesson.
              </span>
            </div>
          )}
        </div>

        <footer className="flex min-w-0 items-center gap-2 border-t border-[#d8d4cc] bg-white px-5 py-2 text-[0.68rem] text-[#656775] max-[600px]:px-3">
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-[#3ab584] shadow-[0_0_7px_#3ab58488]"
            aria-hidden="true"
          />
          <span className="min-w-0 truncate">
            {isTeacher
              ? "Live to everyone in this classroom"
              : `Following ${teacherName}'s board`}
          </span>
          <span className="ml-auto shrink-0 text-right max-[720px]:hidden">
            {isTeacher
              ? "Use the toolbar to draw, type, and explain"
              : "Scroll to pan · pinch or use the controls to zoom"}
          </span>
        </footer>
      </section>
    </div>
  );
}
