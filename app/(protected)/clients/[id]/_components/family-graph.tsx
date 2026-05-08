"use client";

import Link from "next/link";

interface FamilyMember {
  id: number;
  personId: number;
  personName: string;
  relationship: string;
}

interface FamilyGraphProps {
  clientId: number;
  members: FamilyMember[];
}

// ── Classify relationships into layers ──

const PARENT_RELATIONS = new Set(["父", "母", "祖父", "祖母", "岳父", "岳母", "公公", "婆婆"]);
const SPOUSE_RELATIONS = new Set(["配偶", "同居人"]);
const SIBLING_RELATIONS = new Set(["兄", "弟", "姊", "妹"]);
const CHILD_RELATIONS = new Set(["子", "女", "孫子", "孫女"]);
// Everything else (叔, 伯, 姑, 舅, 姨, 姪子, etc.) goes to "other"

function classifyRelation(rel: string): "parent" | "spouse" | "sibling" | "child" | "other" {
  if (PARENT_RELATIONS.has(rel)) return "parent";
  if (SPOUSE_RELATIONS.has(rel)) return "spouse";
  if (SIBLING_RELATIONS.has(rel)) return "sibling";
  if (CHILD_RELATIONS.has(rel)) return "child";
  return "other";
}

// ── Node component ──

function PersonNode({
  name,
  relation,
  href,
  highlight,
}: {
  name: string;
  relation?: string;
  href?: string;
  highlight?: boolean;
}) {
  const displayName = name.length > 5 ? name.slice(0, 5) + "…" : name;
  const content = (
    <div
      className={`
        flex flex-col items-center justify-center rounded-lg border px-3 py-2 text-center
        min-w-[4.5rem] max-w-[6rem]
        ${highlight
          ? "border-primary bg-primary/10 ring-2 ring-primary/30"
          : "border-border bg-card hover:border-primary hover:bg-primary/5 transition-colors"
        }
      `}
    >
      <span className="text-sm font-medium truncate w-full">{displayName}</span>
      {relation && (
        <span className="text-[10px] text-muted-foreground mt-0.5">{relation}</span>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// ── Connector lines ──

function VerticalLine() {
  return <div className="w-px h-4 bg-border mx-auto" />;
}

function HorizontalConnector() {
  return <div className="h-px w-4 bg-border self-center" />;
}

/**
 * Hierarchical family graph with three layers:
 * - Top: parents
 * - Middle: spouse + self + siblings
 * - Bottom: children
 * - Side: other relations
 */
export function FamilyGraph({ clientId, members }: FamilyGraphProps) {
  if (members.length === 0) return null;

  const parents = members.filter((m) => classifyRelation(m.relationship) === "parent");
  const spouses = members.filter((m) => classifyRelation(m.relationship) === "spouse");
  const siblings = members.filter((m) => classifyRelation(m.relationship) === "sibling");
  const children = members.filter((m) => classifyRelation(m.relationship) === "child");
  const others = members.filter((m) => classifyRelation(m.relationship) === "other");

  return (
    <div className="mb-6 py-4 overflow-x-auto">
      <div className="flex flex-col items-center gap-0 min-w-fit mx-auto">

        {/* Top layer: Parents */}
        {parents.length > 0 && (
          <>
            <div className="flex items-center gap-2 justify-center">
              {parents.map((p, i) => (
                <div key={`parent-${p.id}-${p.personId}`} className="flex items-center gap-1">
                  {i > 0 && <HorizontalConnector />}
                  <PersonNode
                    name={p.personName}
                    relation={p.relationship}
                    href={`/clients/${p.personId}`}
                  />
                </div>
              ))}
            </div>
            <VerticalLine />
          </>
        )}

        {/* Middle layer: Spouse + Self + Siblings */}
        <div className="flex items-center gap-2 justify-center">
          {spouses.map((s) => (
            <div key={`spouse-${s.id}-${s.personId}`} className="flex items-center gap-1">
              <PersonNode
                name={s.personName}
                relation={s.relationship}
                href={`/clients/${s.personId}`}
              />
              <HorizontalConnector />
            </div>
          ))}

          <PersonNode name="本人" highlight />

          {siblings.length > 0 && (
            <>
              {siblings.map((s) => (
                <div key={`sibling-${s.id}-${s.personId}`} className="flex items-center gap-1">
                  <HorizontalConnector />
                  <PersonNode
                    name={s.personName}
                    relation={s.relationship}
                    href={`/clients/${s.personId}`}
                  />
                </div>
              ))}
            </>
          )}
        </div>

        {/* Bottom layer: Children */}
        {children.length > 0 && (
          <>
            <VerticalLine />
            <div className="flex items-center gap-2 justify-center">
              {children.map((c) => (
                <PersonNode
                  key={`child-${c.id}-${c.personId}`}
                  name={c.personName}
                  relation={c.relationship}
                  href={`/clients/${c.personId}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Other relations */}
        {others.length > 0 && (
          <div className="mt-4 pt-3 border-t border-dashed border-border w-full">
            <p className="text-xs text-muted-foreground mb-2 text-center">其他關係</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {others.map((o) => (
                <PersonNode
                  key={`other-${o.id}-${o.personId}`}
                  name={o.personName}
                  relation={o.relationship}
                  href={`/clients/${o.personId}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
