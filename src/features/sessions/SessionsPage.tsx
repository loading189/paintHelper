import { useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';
import type { PaintingSession, SessionStatus } from '../../types/models';
import { summarizeSession } from './sessionState';

type SessionsPageProps = {
  sessions: PaintingSession[];
  activeSessionId: string | null;
  onCreate: (title: string) => void;
  onOpenInPrep: (sessionId: string) => void;
  onOpenInActive: (sessionId: string) => void;
  onStatusChange: (sessionId: string, status: SessionStatus) => void;
  onDuplicate: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
};

export const SessionsPage = ({ sessions, activeSessionId, onCreate, onOpenInPrep, onOpenInActive, onStatusChange, onDuplicate, onDelete }: SessionsPageProps) => {
  const [title, setTitle] = useState('');
  const visibleSessions = useMemo(() => [...sessions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)), [sessions]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <Card className="p-5 sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),360px] xl:items-end">
          <SectionTitle eyebrow="Session archive" description="Create painting plans, revisit active work, and keep completed studies available as local references.">
            Painting sessions
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {[
              { label: 'Total sessions', value: sessions.length, note: 'all locally stored painting workflows' },
              { label: 'Active now', value: sessions.filter((session) => session.status === 'active').length, note: 'sessions currently in painting mode' },
              { label: 'Archived', value: sessions.filter((session) => session.status === 'archived').length, note: 'completed or shelved studies' },
            ].map((item) => (
              <div key={item.label} className="studio-metric">
                <p className="studio-eyebrow">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">{item.value}</p>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-5 sm:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <SectionTitle eyebrow="New session" description="Create a planning board before you start laying out colors for a new painting.">
            Start a painting session
          </SectionTitle>
          <div className="flex w-full flex-col gap-3 sm:flex-row xl:max-w-xl">
            <input className="studio-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Portrait under warm window light" />
            <button
              className="studio-button studio-button-primary"
              type="button"
              onClick={() => {
                onCreate(title.trim() || 'New painting session');
                setTitle('');
              }}
            >
              Create session
            </button>
          </div>
        </div>
      </Card>

      {visibleSessions.length === 0 ? (
        <Card className="p-6 sm:p-7">
          <div className="rounded-[28px] border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-1)]/74 px-5 py-10 text-center">
            <p className="studio-eyebrow">No sessions yet</p>
            <p className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">Build your first preparation board</p>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[color:var(--text-muted)]">Sessions connect target planning, recipe selection, and active painting into one deterministic local workflow.</p>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {visibleSessions.map((session) => {
          const summary = summarizeSession(session);
          const isCurrent = session.id === activeSessionId;
          return (
            <Card key={session.id} className="p-5 sm:p-7">
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[1.4rem] font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">{session.title}</h3>
                      {isCurrent ? <span className="studio-chip studio-chip-info">Current session</span> : null}
                    </div>
                    <p className="mt-2 text-sm text-[color:var(--text-muted)]">Updated {new Date(session.updatedAt).toLocaleString()}</p>
                  </div>
                  <select className="studio-select max-w-[180px]" value={session.status} onChange={(event) => onStatusChange(session.id, event.target.value as SessionStatus)}>
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="studio-metric"><p className="studio-eyebrow">Targets</p><p className="mt-2 text-xl font-semibold text-[color:var(--text-strong)]">{summary.targetCount}</p></div>
                  <div className="studio-metric"><p className="studio-eyebrow">Locked recipes</p><p className="mt-2 text-xl font-semibold text-[color:var(--text-strong)]">{summary.lockedCount}</p></div>
                  <div className="studio-metric"><p className="studio-eyebrow">Active board</p><p className="mt-2 text-xl font-semibold text-[color:var(--text-strong)]">{summary.activeCount}</p></div>
                </div>

                {session.notes ? <p className="text-sm leading-7 text-[color:var(--text-muted)]">{session.notes}</p> : null}

                <div className="flex flex-wrap gap-3">
                  <button className="studio-button studio-button-primary" type="button" onClick={() => onOpenInPrep(session.id)}>Open prep</button>
                  <button className="studio-button studio-button-secondary" type="button" onClick={() => onOpenInActive(session.id)}>Open active</button>
                  <button className="studio-button studio-button-secondary" type="button" onClick={() => onDuplicate(session.id)}>Duplicate</button>
                  <button className="studio-button studio-button-danger" type="button" onClick={() => onDelete(session.id)}>Delete</button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
