import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { CreditCard, BedDouble, TrendingUp, Users } from "lucide-react";

/* /admin/_design — Quiet Luxury v3.0 component gallery
 * Reference for designers/engineers building new pages.
 * Mirrors the canonical patterns in docs/DESIGN_GUIDELINES.md. */

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary">{title}</h2>
        {hint && <p className="text-sm text-text-secondary mt-1">{hint}</p>}
      </div>
      <Card className="p-6">{children}</Card>
    </section>
  );
}

function Swatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-10 w-10 rounded-md border border-border-subtle flex-shrink-0"
        style={{ background: `var(${varName})` }}
      />
      <div className="min-w-0">
        <div className="text-sm font-medium text-text-primary">{name}</div>
        <div className="text-[11px] font-mono text-text-tertiary">{varName}</div>
      </div>
    </div>
  );
}

export default function DesignGallery() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Internal · v3.0"
        title="Design System"
        description="Quiet Luxury Edition. Use these patterns when building new pages or refactoring existing ones."
        actions={
          <a
            href="https://docs.anthropic.com"
            className="text-xs text-text-tertiary hover:text-text-primary underline-offset-4 hover:underline"
          >
            See full guideline →
          </a>
        }
      />

      {/* Color tokens */}
      <Section title="Surface" hint="Background hierarchy — solid only, no gradients (§2.2).">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Swatch name="surface-base"    varName="--surface-base" />
          <Swatch name="surface-1"       varName="--surface-1" />
          <Swatch name="surface-2"       varName="--surface-2" />
          <Swatch name="surface-3"       varName="--surface-3" />
          <Swatch name="surface-overlay" varName="--surface-overlay" />
        </div>
      </Section>

      <Section title="Accent · Status" hint="Single gold accent + four status colors. Nothing else.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Swatch name="gold"       varName="--gold" />
          <Swatch name="gold-hover" varName="--gold-hover" />
          <Swatch name="success"    varName="--status-success" />
          <Swatch name="warning"    varName="--status-warning" />
          <Swatch name="danger"     varName="--status-danger" />
          <Swatch name="info"       varName="--status-info" />
        </div>
      </Section>

      <Section title="Text" hint="Hierarchy via weight + opacity, never via color (§2.3).">
        <div className="space-y-2">
          <p className="text-text-primary">text-primary — body, headings, primary content</p>
          <p className="text-text-secondary">text-secondary — sub text, descriptions</p>
          <p className="text-text-tertiary">text-tertiary — captions, metadata, labels</p>
          <p className="text-text-disabled">text-disabled — disabled states</p>
        </div>
      </Section>

      {/* Typography */}
      <Section title="Typography" hint="Playfair on h1 + logo only. h2–h6 use Inter (§3).">
        <div className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-tertiary mb-1">h1 · display</p>
            <h1 className="font-display text-4xl font-medium tracking-tight text-text-primary">Operations</h1>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-tertiary mb-1">h2 · sans</p>
            <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Today's Sessions</h2>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-tertiary mb-1">h3 · sans</p>
            <h3 className="text-lg font-semibold text-text-primary">Room VIP-3</h3>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-tertiary mb-1">numeric · mono</p>
            <span className="font-mono tabular-nums text-3xl text-text-primary">RM 12,480.00</span>
          </div>
        </div>
      </Section>

      {/* Buttons */}
      <Section title="Buttons" hint="4 variants: primary / secondary / ghost / destructive (§7.1).">
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      {/* Inputs */}
      <Section title="Form" hint="h-9, surface-3 background, gold focus ring (§7.3).">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wide text-text-secondary mb-1.5">
              Email
            </label>
            <Input placeholder="you@example.com" />
            <p className="text-xs text-text-tertiary mt-1.5">Helper text</p>
          </div>
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wide text-text-secondary mb-1.5">
              Disabled
            </label>
            <Input placeholder="Disabled" disabled />
          </div>
        </div>
      </Section>

      {/* Status */}
      <Section title="Status Badges" hint="Reduced to 4 groups: success / warning / danger / neutral (§7.4).">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="confirmed" />
          <StatusBadge status="checked_in" />
          <StatusBadge status="paid" />
          <StatusBadge status="tentative" />
          <StatusBadge status="pending" />
          <StatusBadge status="in_progress" />
          <StatusBadge status="cancelled" />
          <StatusBadge status="no_show" />
          <StatusBadge status="dirty" />
          <StatusBadge status="checked_out" />
          <StatusBadge status="draft" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </Section>

      {/* KPI Cards */}
      <Section title="KPI Cards" hint="Only the page's primary KPI uses gold emphasis (§12).">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Today's Revenue"
            value="RM 12,480"
            icon={CreditCard}
            emphasis="gold"
            delta={{ value: "+12.4%", trend: "up" }}
            deltaSuffix="vs yesterday"
          />
          <KpiCard label="Occupancy" value="78%"  icon={TrendingUp} delta={{ value: "+4pp", trend: "up" }} />
          <KpiCard label="Reservations" value="34" icon={Users} />
          <KpiCard label="Rooms Available" value="6 / 28" icon={BedDouble} delta={{ value: "-2", trend: "down" }} />
        </div>
      </Section>

      {/* Table */}
      <Section title="Table" hint="Linear style — horizontal borders only, no zebra, hover = surface-3 (§8).">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Room</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">VIP-3</TableCell>
              <TableCell className="text-text-secondary">Tan Wei Ming</TableCell>
              <TableCell className="text-right font-mono tabular-nums">RM 1,240.00</TableCell>
              <TableCell className="text-right"><StatusBadge status="active" /></TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">VIP-1</TableCell>
              <TableCell className="text-text-secondary">Lee Hyun-woo</TableCell>
              <TableCell className="text-right font-mono tabular-nums">RM 3,860.00</TableCell>
              <TableCell className="text-right"><StatusBadge status="tentative" /></TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">B-7</TableCell>
              <TableCell className="text-text-secondary">Nattaya S.</TableCell>
              <TableCell className="text-right font-mono tabular-nums">RM 480.00</TableCell>
              <TableCell className="text-right"><StatusBadge status="cancelled" /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Section>

      {/* Checklist */}
      <Section title="§16 Checklist" hint="Run through this before merging any new page.">
        <ul className="text-sm text-text-secondary space-y-1.5 list-disc pl-5 marker:text-text-tertiary">
          <li>Page header follows the eyebrow → h1 → description → actions pattern</li>
          <li>At most 1–2 primary buttons per page</li>
          <li>All colors come from tokens (no raw hex / Tailwind palette colors)</li>
          <li>Zero gradients (overlay backdrop excepted)</li>
          <li>Playfair only on h1 and the logo</li>
          <li>Numbers use <code className="font-mono text-xs">font-mono tabular-nums</code></li>
          <li>Tables: horizontal borders only, hover = surface-3</li>
          <li>No category-specific colors in nav</li>
          <li>All interactive elements have <code className="font-mono text-xs">focus-visible</code> rings</li>
          <li>Loading / empty / error states are defined</li>
          <li>Renders correctly at 375px width</li>
          <li>Holds up at 1.4× text length (Thai)</li>
          <li>Respects <code className="font-mono text-xs">prefers-reduced-motion</code></li>
        </ul>
      </Section>
    </div>
  );
}
