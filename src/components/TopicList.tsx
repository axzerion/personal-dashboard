import type {ContentItem} from "../data/content"

export default function TopicList({items}: { items: ContentItem[] }) {
    return (
        <ul className="topic-grid">
            {items.map((item) => (
                <li key={item.id} className="topic-card">
                    <h3>{item.title}</h3>
                    {item.note && <p>{item.note}</p>}
                </li>
            ))}
        </ul>
    )
}
