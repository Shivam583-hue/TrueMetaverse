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

  // useEffect(() => {
  //   closeButtonRef.current?.focus();
  //   const handleKeyDown = (event: KeyboardEvent) => {
  //     if (event.key === "Escape") onClose();
  //   };
  //   window.addEventListener("keydown", handleKeyDown);
  //   return () => window.removeEventListener("keydown", handleKeyDown);
  // }, [onClose]);


  //  run  initial dialogue focus only when mounted
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Escape listener, may depend on onClose
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (
      !excalidrawApi ||
      appliedSceneVersionRef.current === sceneVersion
    ) {
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
      className="whiteboard-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="whiteboard-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="whiteboard-title"
      >
        <header className="whiteboard-header">
          <div className="whiteboard-heading">
            <div className="whiteboard-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div>
              <div className="whiteboard-title-row">
                <h2 id="whiteboard-title">Classroom whiteboard</h2>
                <span
                  className={`whiteboard-mode${isTeacher ? " teacher" : ""}`}
                >
                  {isTeacher ? "Editing" : "View only"}
                </span>
              </div>
              <p>
                <span className="whiteboard-teacher-avatar" aria-hidden="true">
                  {teacherInitial}
                </span>
                <strong>{teacherName}</strong> is the teacher
                <span aria-hidden="true"> · </span>
                {isTeacher
                  ? "your work syncs live with the class"
                  : "their work appears here live"}
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            className="whiteboard-close"
            onClick={onClose}
            aria-label="Close whiteboard"
            title="Close (Esc)"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="whiteboard-canvas">
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
            <div className="whiteboard-empty" aria-live="polite">
              <span className="whiteboard-empty-icon" aria-hidden="true">
                ✎
              </span>
              <strong>The board is ready</strong>
              <span>Waiting for {teacherName} to start the lesson.</span>
            </div>
          )}
        </div>

        <footer className="whiteboard-footer">
          <span className="" aria-hidden="true" />
          <span>
            {isTeacher
              ? "Live to everyone in this classroom"
              : `Following ${teacherName}'s board`}
          </span>
          <span className="whiteboard-footer-hint">
            {isTeacher
              ? "Use the toolbar to draw, type, and explain"
              : "Scroll to pan · pinch or use the controls to zoom"}
          </span>
        </footer>
      </section>
    </div>
  );
}
