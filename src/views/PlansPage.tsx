import type { Plan } from "../types/domain";
export function PlansPage({ plans, onEdit }: { plans: Plan[]; onEdit: (p: Plan) => void }) {
  return (
    <section className="section-panel">
      <div className="plan-cards">
        {plans.map((p) => (
          <article key={p.id}>
            <span>{p.name[0]}</span>
            <h3>{p.name}</h3>
            <strong>
              AED {p.price}
              <small>/month</small>
            </strong>
            <p>
              {p.washesPerMonth === null
                ? "Custom or unlimited washes"
                : `${p.washesPerMonth} washes every month`}
            </p>
            <button className="secondary" onClick={() => onEdit(p)}>
              Edit plan
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
