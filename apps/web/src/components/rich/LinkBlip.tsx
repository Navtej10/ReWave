import { useState } from "react";
import { Chip } from "../ui/index";
import { LinkIcon } from "./richIcons";
import type { LinkPreview } from "../../wave/types";

/** Unfurl card. Falls back to the domain and a link doodle when there is no description or thumbnail. */
export function LinkBlip({ link }: { link: LinkPreview }) {
  const [thumbOk, setThumbOk] = useState(true);
  const showThumb = Boolean(link.thumbnailUrl) && thumbOk;
  return (
    <a
      className="sketch sketch-b rc-link"
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${link.title || link.domain}, ${link.domain} (opens in a new tab)`}
    >
      <span className="rc-link__thumb">
        {showThumb ? (
          <img
            src={link.thumbnailUrl}
            alt=""
            width={72}
            height={72}
            loading="lazy"
            decoding="async"
            onError={() => setThumbOk(false)}
          />
        ) : (
          <LinkIcon size={26} />
        )}
      </span>
      <span className="rc-link__body">
        <span className="rc-link__title">{link.title || link.domain}</span>
        {link.description ? <span className="rc-link__desc">{link.description}</span> : null}
        <Chip className="rc-link__domain">{link.domain}</Chip>
      </span>
    </a>
  );
}
