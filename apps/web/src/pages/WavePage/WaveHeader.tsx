import { Button, cx } from "../../components/ui/index";
import type { ConnectionStatus } from "./types";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: "Connecting...",
  online: "Online",
  offline: "Offline",
};

export interface WaveHeaderProps {
  title: string;
  status: ConnectionStatus;
  userInitials: string;
  onCopyInvite: () => void;
  onMore: () => void;
}

export function WaveHeader({ title, status, userInitials, onCopyInvite, onMore }: WaveHeaderProps) {
  return (
    <header className="wp-header">
      <h1 className="wp-header__title">{title}</h1>
      <div className="wp-header__tools">
        {/* Text always accompanies the dot, so status never relies on color alone. */}
        <span className="wp-status">
          <span className={cx("wp-status__dot", `is-${status}`)} aria-hidden="true" />
          {STATUS_LABEL[status]}
        </span>
        <span className="wp-avatar" role="img" aria-label={`Signed in as ${userInitials}`}>
          {userInitials}
        </span>
        <Button variant="ghost" className="wp-btn-sm" onClick={onCopyInvite}>
          Copy invite link
        </Button>
        <Button variant="ghost" className="wp-btn-sm wp-btn-more" aria-label="More actions" onClick={onMore}>
          ...
        </Button>
      </div>
    </header>
  );
}
