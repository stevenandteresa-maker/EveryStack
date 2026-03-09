'use client';

/**
 * PeopleCell — display and edit components for people field type.
 *
 * Display: Configurable — grey pill+avatar (default), colored pill+name, or avatar only.
 * Edit: People picker dropdown with search. Uses placeholder data for now
 * (server-side workspace member query ships later).
 *
 * @see docs/reference/tables-and-views.md § Cell Type Rendering
 */

/* eslint-disable @next/next/no-img-element */
import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Lock, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PillBadge } from './PillBadge';
import { OverflowBadge } from './OverflowBadge';
import type { CellRendererProps } from '../GridCell';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PersonValue {
  id: string;
  name: string;
  avatarUrl?: string;
}

type PeopleDisplayStyle = 'pill_avatar' | 'pill_name' | 'avatar_only';

function getDisplayStyle(field: CellRendererProps['field']): PeopleDisplayStyle {
  const display = field.display as Record<string, unknown> | null;
  const style = display?.style;
  if (style === 'pill_name' || style === 'avatar_only') return style;
  return 'pill_avatar';
}

function toPeopleArray(value: unknown): PersonValue[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is PersonValue =>
      v != null && typeof v === 'object' && 'id' in v && 'name' in v,
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Maximum visible items before overflow */
const MAX_VISIBLE = 3;

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export function PeopleCellDisplay({ value, field }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const people = toPeopleArray(value);

  if (people.length === 0) return null;

  const displayStyle = getDisplayStyle(field);
  const visible = people.slice(0, MAX_VISIBLE);
  const overflowCount = people.length - MAX_VISIBLE;
  const overflowLabels = people.slice(MAX_VISIBLE).map((p) => p.name);

  return (
    <div className="flex w-full items-center gap-1 overflow-hidden">
      {displayStyle === 'avatar_only' && (
        <>
          {visible.map((person) => (
            <span
              key={person.id}
              className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-300 text-[9px] font-semibold text-white"
              title={person.name}
            >
              {person.avatarUrl ? (
                <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                getInitials(person.name)
              )}
            </span>
          ))}
        </>
      )}
      {displayStyle === 'pill_avatar' && (
        <>
          {visible.map((person) => (
            <PillBadge
              key={person.id}
              text={person.name}
              avatarUrl={person.avatarUrl}
              avatarFallback={getInitials(person.name)}
              bgColor="#F1F5F9"
              textColor="#0F172A"
            />
          ))}
        </>
      )}
      {displayStyle === 'pill_name' && (
        <>
          {visible.map((person) => (
            <PillBadge
              key={person.id}
              text={person.name}
              bgColor="#DBEAFE"
              textColor="#1E40AF"
            />
          ))}
        </>
      )}
      {overflowCount > 0 && (
        <OverflowBadge count={overflowCount} labels={overflowLabels} />
      )}
      {field.readOnly && (
        <Lock
          className="h-3 w-3 shrink-0 text-slate-400"
          aria-label={t('read_only')}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------

export function PeopleCellEdit({ value, field: _field, onSave, onCancel }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PersonValue[]>(toPeopleArray(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Placeholder data — server-side workspace member query deferred
  const allMembers: PersonValue[] = useMemo(() => {
    // Use existing selected people as available options for now
    return toPeopleArray(value);
  }, [value]);

  const filteredMembers = useMemo(() => {
    if (!search) return allMembers;
    const q = search.toLowerCase();
    return allMembers.filter((m) => m.name.toLowerCase().includes(q));
  }, [allMembers, search]);

  function togglePerson(person: PersonValue) {
    const isSelected = selected.some((s) => s.id === person.id);
    const next = isSelected
      ? selected.filter((s) => s.id !== person.id)
      : [...selected, person];
    setSelected(next);
    onSave(next);
  }

  return (
    <div className="absolute left-0 top-full z-50 mt-0.5 min-w-[200px] rounded-md border border-slate-200 bg-white shadow-lg">
      <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-1.5">
        <Search className="h-3.5 w-3.5 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          placeholder={t('people_search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
        />
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {filteredMembers.map((person) => {
          const isSelected = selected.some((s) => s.id === person.id);
          return (
            <button
              key={person.id}
              type="button"
              className={cn(
                'flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-slate-50',
                isSelected && 'bg-slate-50',
              )}
              onClick={() => togglePerson(person)}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-300 text-[8px] font-semibold text-white">
                {person.avatarUrl ? (
                  <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  getInitials(person.name)
                )}
              </span>
              <span className="truncate">{person.name}</span>
              {isSelected && <Check className="ml-auto h-3.5 w-3.5 text-slate-600" />}
            </button>
          );
        })}
        {filteredMembers.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-slate-400">{t('people_no_results')}</div>
        )}
      </div>
    </div>
  );
}
