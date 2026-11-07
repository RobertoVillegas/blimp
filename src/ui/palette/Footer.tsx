import type { AiFeature, AiStatus } from '@/shared/types';
import { FEATURE_OF, type PaletteCommand } from './commands';

/** The status of the profile a feature actually uses. */
export function statusFor(status: AiStatus | undefined, feature: AiFeature | undefined): AiStatus | undefined {
  return (feature && status?.byFeature?.[feature]) || status;
}

/** Bottom bar: what the selected command sends where, and the active AI profile. */
export function Footer({ status: active, command, note: override }: { status?: AiStatus; command?: PaletteCommand; note?: string }) {
  const status = statusFor(active, command && FEATURE_OF[command.id]);
  let note = override ?? command?.description ?? 'Enter to run · ↑↓ to move · Esc to close';
  if (!override && command?.sends && status) {
    note = status.configured
      ? status.hosted
        ? `Sends ${command.sends} to ${status.profileName}.`
        : `Uses ${status.profileName}; ${command.sends} stay on this device.`
      : `${status.problem} Enter opens AI Settings.`;
  }
  return (
    <footer className="hm-footer">
      <span className="hm-note">{note}</span>
      {status && (
        <span className="hm-provider" title={status.configured ? undefined : status.problem}>
          {status.configured ? `${status.profileName} · ${status.model}` : `${status.profileName}: not set up`}
        </span>
      )}
    </footer>
  );
}
