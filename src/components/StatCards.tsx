import type {ContentItem} from "../data/content"

export default function StatCards({items}: { items: ContentItem[] }) {
    return (
        <div className="stat-grid">
            {items.map((item) => (
                <div key={item.id} className="stat-card">
                    <span className="label">{item.title}</span>
                    <strong>{item.value || "—"}</strong>
                    {item.note && <p>{item.note}</p>}
                </div>
            ))}
        </div>
    )
}
