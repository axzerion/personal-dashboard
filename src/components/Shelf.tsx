import type {ContentItem, ItemStatus} from "../data/content"

const statusLabels: Record<ItemStatus, string> = {
    favorite: "Favorite",
    current: "Now",
    want: "Up next",
    done: "Done",
}

interface ShelfProps {
    items: ContentItem[]
    ratio: "poster" | "wide"
}

export default function Shelf({items, ratio}: ShelfProps) {
    return (
        <div className={`shelf shelf-${ratio}`}>
            {items.map((item) => {
                const body = (
                    <>
                        <div className="shelf-cover">
                            {item.cover ? (
                                <img src={item.cover} alt="" loading="lazy"/>
                            ) : (
                                <span className="shelf-fallback">{item.title}</span>
                            )}
                        </div>
                        <span className="shelf-title">{item.title}</span>
                        {item.subtitle && <span className="shelf-sub">{item.subtitle}</span>}
                        {item.status && (
                            <span className="shelf-status">{statusLabels[item.status]}</span>
                        )}
                        {item.note && <p className="shelf-note">{item.note}</p>}
                    </>
                )

                return item.url ? (
                    <a
                        key={item.id}
                        className="shelf-item"
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                    >
                        {body}
                    </a>
                ) : (
                    <div key={item.id} className="shelf-item">
                        {body}
                    </div>
                )
            })}
        </div>
    )
}
