import { money } from "../lib/format.js";

export default function ProductCard({ product }) {
  return (
    <article className="mini-card">
      <span className="pill">{product.featured ? "Featured" : product.strainType}</span>
      <h3>{product.name}</h3>
      <p>{product.description}</p>
      <strong>{money(product.price)}</strong>
    </article>
  );
}
