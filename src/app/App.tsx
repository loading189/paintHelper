import { useEffect, useMemo, useRef, useState } from 'react';
import MixerPage from '../features/mixer/MixerPage';
import { ActivePaintingPage } from '../features/active/ActivePaintingPage';
import { PaintsPage } from '../features/paints/PaintsPage';
import { SessionsPage } from '../features/sessions/SessionsPage';
import { loadAppState, saveAppState } from '../lib/storage/localState';
import { createPaintingSession, createStarterSessionState, prepareSessionForPainting } from '../features/sessions/sessionState';
import { createLockedConfigDraft, saveLockedConfiguration } from '../lib/storage/configRegistry';
import type { Paint, WorkspaceView } from '../types/models';
import { createId } from '../lib/utils/id';
import shellStyles from './AppShell.module.css';

const navItems: Array<{ id: WorkspaceView; label: string }> = [
  { id: 'paint', label: 'Paint' },
  { id: 'mixer', label: 'Mixer' },
  { id: 'projects', label: 'Projects' },
  { id: 'paints', label: 'Paints' },
];

const App = () => {
  const [view, setView] = useState<WorkspaceView>('paint');
  const [state, setState] = useState(loadAppState);
  const [saveMessage, setSaveMessage] = useState('');
  const [isPreparingSave, setIsPreparingSave] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  useEffect(() => {
    if (!saveMessage) return;
    const t = setTimeout(() => setSaveMessage(''), 2500);
    return () => clearTimeout(t);
  }, [saveMessage]);

  const currentSession = useMemo(
    () =>
      state.sessions.find((s) => s.id === state.currentSessionId) ??
      state.sessions[0] ??
      null,
    [state.currentSessionId, state.sessions],
  );

  const upsertPaint = (paint: Paint) => {
    setState((current) => {
      const exists = current.paints.some((p) => p.id === paint.id);
      return {
        ...current,
        paints: exists
          ? current.paints.map((p) => (p.id === paint.id ? paint : p))
          : [...current.paints, paint],
      };
    });
  };

  const createProject = () => {
    setState((current) =>
      createStarterSessionState(current, `Painting ${current.sessions.length + 1}`),
    );
  };

  const updateSession = (next: NonNullable<typeof currentSession>) => {
    setState((c) => ({
      ...c,
      sessions: c.sessions.map((s) =>
        s.id === next.id ? next : s,
      ),
    }));
  };

  const saveProject = () => {
    if (!currentSession) return;

    setIsPreparingSave(true);
    setSaveMessage('Preparing palette…');

    const prepared = prepareSessionForPainting(
      currentSession,
      state.paints,
      state.settings,
    );

    updateSession(prepared);

    // Locked config registry is intentionally separate from editable app/session state.
    // Browser-only mode stores immutable-ish versions in localStorage and supports export/import.
    const lockedDraft = createLockedConfigDraft({
      configName: `${prepared.title} mixer config`,
      paints: state.paints,
      settings: state.settings,
    });
    saveLockedConfiguration(lockedDraft, 'new-version');

    setTimeout(() => {
      setIsPreparingSave(false);
      setSaveMessage('Ready for Paint');
    }, 300);
  };

  const handleHeaderUpload = async (file: File | undefined) => {
    if (!file || !currentSession) {
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    updateSession({
      ...currentSession,
      referenceImage: {
        id: createId('reference-image'),
        name: file.name,
        mimeType: file.type,
        dataUrl,
        addedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className={shellStyles.appShell}>
      <div className={shellStyles.bg} />

      <header className={shellStyles.header}>
        <div className={shellStyles.brand}>
          <div className={shellStyles.brandDot} />
          <span className={shellStyles.brandText}>Paint Mix Matcher</span>
        </div>

        <nav className={shellStyles.nav}>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`${shellStyles.navBtn} ${
                view === item.id ? shellStyles.navBtnActive : ''
              }`}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className={shellStyles.actions}>
          {currentSession ? (
            <>
              <input
                className={shellStyles.projectInput}
                value={currentSession.title}
                onChange={(e) =>
                  updateSession({
                    ...currentSession,
                    title: e.target.value,
                    updatedAt: new Date().toISOString(),
                  })
                }
              />

              {view === 'paint' ? (
                <>
                  <button
                    className="studio-button studio-button-secondary"
                    type="button"
                    onClick={() => uploadInputRef.current?.click()}
                  >
                    Upload
                  </button>
                  <input
                    ref={uploadInputRef}
                    className="hidden"
                    type="file"
                    accept="image/*"
                    onChange={(event) => void handleHeaderUpload(event.target.files?.[0])}
                  />
                </>
              ) : null}

              <button
                className="studio-save-btn"
                onClick={saveProject}
                disabled={isPreparingSave}
              >
                {isPreparingSave ? '…' : 'Save'}
              </button>
            </>
          ) : (
            <button
              className="studio-save-btn"
              onClick={() => {
                const session = createPaintingSession({
                  title: `Painting ${state.sessions.length + 1}`,
                });
                setState((c) => ({
                  ...c,
                  sessions: [session, ...c.sessions],
                  currentSessionId: session.id,
                }));
              }}
            >
              New
            </button>
          )}
        </div>
      </header>

      <main className={shellStyles.main}>
        {view === 'paint' && (
          <ActivePaintingPage
            session={currentSession}
            paints={state.paints}
            settings={state.settings}
            onSessionChange={updateSession}
          />
        )}

        {view === 'mixer' && <MixerPage />}

        {view === 'projects' && (
          <SessionsPage
            sessions={state.sessions}
            currentSessionId={state.currentSessionId}
            onSelect={(id) => {
              setState((c) => ({ ...c, currentSessionId: id }));
              setView('paint');
            }}
            onCreate={createProject}
          />
        )}

        {view === 'paints' && (
          <PaintsPage
            paints={state.paints}
            onCreate={upsertPaint}
            onUpdate={upsertPaint}
            onDelete={(id) =>
              setState((c) => ({
                ...c,
                paints: c.paints.filter((p) => p.id !== id),
              }))
            }
          />
        )}
      </main>
    </div>
  );
};

export default App;
