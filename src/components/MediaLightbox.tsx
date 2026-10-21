import {useEffect, useRef} from "react"
import {embedUrl} from "../data/media"
import type {MediaView} from "../data/media"

interface MediaLightboxProps {
    media: MediaView | null
    onClose: () => void
}

// Native <dialog>: Esc closes it, focus stays inside, and the page behind is inert.
export default function MediaLightbox({media, onClose}: MediaLightboxProps) {
    const ref = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        const dialog = ref.current
        if (!dialog) return

        if (media && !dialog.open) dialog.showModal()
        if (!media && dialog.open) dialog.close()
    }, [media])

    return (
        <dialog
            ref={ref}
            className="lightbox"
            aria-label={media?.title ?? "Media viewer"}
            onClose={onClose}
            onClick={(event) => {
                // Clicking the dimmed area outside the box closes it.
                if (event.target === event.currentTarget) onClose()
            }}
        >
            {media && (
                <div className="lightbox-inner">
                    {media.kind === "video" ? (
                        <div className="lightbox-frame">
                            <iframe
                                src={embedUrl(media.id, media.start)}
                                title={media.title}
                                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                                allowFullScreen
                                referrerPolicy="strict-origin-when-cross-origin"
                            />
                        </div>
                    ) : (
                        <img className="lightbox-image" src={media.src} alt={media.title}/>
                    )}

                    <div className="lightbox-bar">
                        <span className="lightbox-title">{media.title}</span>
                        <span className="lightbox-actions">
                            <a href={media.url} target="_blank" rel="noreferrer">
                                {media.kind === "video" ? "Watch on YouTube ↗" : "Open original ↗"}
                            </a>
                            <button type="button" className="button" onClick={onClose}>
                                Close
                            </button>
                        </span>
                    </div>
                </div>
            )}
        </dialog>
    )
}
