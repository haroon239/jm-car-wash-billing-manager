import { useState } from "react";
import type { LocationSummary } from "../types/domain";

type Props = {
  locations: LocationSummary[];
  selectedAreaId: number | null;
  selectedBuildingId: number | null;
  onSelectArea: (id: number | null) => void;
  onSelectBuilding: (id: number | null) => void;
  onAddArea: () => void;
  onAddBuilding: (areaId: number) => void;
  onUseBuilding: (areaId: number, buildingId: number) => void;
  onUpdateBuilding: (buildingId: number, areaId: number, name: string) => Promise<boolean>;
  onArchiveBuilding: (buildingId: number) => Promise<boolean>;
};

const money = (value: number) => `AED ${value.toFixed(2)}`;

export function LocationsPage({
  locations,
  selectedAreaId,
  selectedBuildingId,
  onSelectArea,
  onSelectBuilding,
  onAddArea,
  onAddBuilding,
  onUseBuilding,
  onUpdateBuilding,
  onArchiveBuilding,
}: Props) {
  const [showEditBuilding, setShowEditBuilding] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAreaId, setEditAreaId] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const areas = Array.from(
    new Map(locations.map((location) => [location.areaId, location])).values(),
  );
  const visibleBuildings = selectedAreaId
    ? locations.filter((location) => location.areaId === selectedAreaId)
    : locations;
  const selectedBuilding = locations.find((location) => location.buildingId === selectedBuildingId);

  if (selectedBuilding) {
    return (
      <section className="locations-page">
        <button className="profile-back" onClick={() => onSelectBuilding(null)}>
          ← Back to buildings
        </button>
        <div className="panel location-profile-hero">
          <div>
            <span className="ready">BUILDING 360°</span>
            <h2>{selectedBuilding.buildingName}</h2>
            <p>
              {selectedBuilding.propertyName} · {selectedBuilding.areaName}
            </p>
          </div>
          <div className="profile-actions">
            <button
              className="secondary"
              onClick={() => {
                setEditName(selectedBuilding.buildingName);
                setEditAreaId(selectedBuilding.areaId);
                setShowEditBuilding(true);
              }}
            >
              Edit building
            </button>
            <button
              className="primary"
              onClick={() => onUseBuilding(selectedBuilding.areaId, selectedBuilding.buildingId)}
            >
              View customers
            </button>
          </div>
        </div>
        <div className="location-kpis">
          <article>
            <small>ACTIVE CUSTOMERS</small>
            <strong>{selectedBuilding.activeCustomers}</strong>
          </article>
          <article>
            <small>EXPECTED MONTHLY</small>
            <strong>{money(selectedBuilding.expectedRevenue)}</strong>
          </article>
          <article>
            <small>COLLECTED</small>
            <strong>{money(selectedBuilding.collected)}</strong>
          </article>
          <article>
            <small>OUTSTANDING</small>
            <strong>{money(selectedBuilding.outstanding)}</strong>
          </article>
          <article className={selectedBuilding.overdue > 0 ? "critical" : ""}>
            <small>OVERDUE</small>
            <strong>{money(selectedBuilding.overdue)}</strong>
          </article>
        </div>
        <section className="panel location-financial-panel">
          <h3>Financial performances</h3>
          <dl>
            <div>
              <dt>Total invoiced</dt>
              <dd>{money(selectedBuilding.invoiced)}</dd>
            </div>
            <div>
              <dt>Total collected</dt>
              <dd>{money(selectedBuilding.collected)}</dd>
            </div>
            <div>
              <dt>Collection rate</dt>
              <dd>
                {selectedBuilding.invoiced > 0
                  ? `${((selectedBuilding.collected / selectedBuilding.invoiced) * 100).toFixed(1)}%`
                  : "—"}
              </dd>
            </div>
          </dl>
        </section>
        {showEditBuilding && (
          <div className="modal-backdrop" onMouseDown={() => setShowEditBuilding(false)}>
            <section
              className="building-edit-modal"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="modal-head">
                <div>
                  <span className="ready">BUILDING RECORD</span>
                  <h2>Edit building</h2>
                  <p>Update the building name or move it to another area.</p>
                </div>
                <button onClick={() => setShowEditBuilding(false)}>×</button>
              </div>
              <form
                className="building-edit-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setIsSaving(true);
                  const saved = await onUpdateBuilding(
                    selectedBuilding.buildingId,
                    editAreaId,
                    editName,
                  );
                  setIsSaving(false);
                  if (saved) setShowEditBuilding(false);
                }}
              >
                <label>
                  <span>Building name</span>
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                  />
                </label>
                <label>
                  <span>Area / cluster</span>
                  <select
                    required
                    value={editAreaId}
                    onChange={(event) => setEditAreaId(Number(event.target.value))}
                  >
                    {areas.map((area) => (
                      <option key={area.areaId} value={area.areaId}>
                        {area.areaName}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="building-edit-warning">
                  <strong>Safe archive</strong>
                  <p>
                    A building can only be archived after all active customers are moved or
                    archived. Invoice history will remain safe.
                  </p>
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="danger"
                    disabled={isSaving}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          `Archive ${selectedBuilding.buildingName}? Historical invoices will remain available.`,
                        )
                      )
                        return;
                      setIsSaving(true);
                      const archived = await onArchiveBuilding(selectedBuilding.buildingId);
                      setIsSaving(false);
                      if (archived) setShowEditBuilding(false);
                    }}
                  >
                    Archive building
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setShowEditBuilding(false)}
                  >
                    Cancel
                  </button>
                  <button className="primary" type="submit" disabled={isSaving}>
                    {isSaving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="locations-page">
      <div className="location-toolbar">
        <div>
          <h2>Areas & buildings</h2>
          <p>Choose a location to view its customers and financial performance.</p>
        </div>
        <button className="primary" onClick={onAddArea}>
          + Add area
        </button>
      </div>
      <div className="area-cards">
        <button
          className={selectedAreaId === null ? "area-card active" : "area-card"}
          onClick={() => {
            onSelectArea(null);
            onSelectBuilding(null);
          }}
        >
          <strong>All areas</strong>
          <span>{locations.length} buildings</span>
        </button>
        {areas.map((area) => {
          const buildings = locations.filter((location) => location.areaId === area.areaId);
          const customers = buildings.reduce((sum, building) => sum + building.activeCustomers, 0);
          return (
            <button
              key={area.areaId}
              className={selectedAreaId === area.areaId ? "area-card active" : "area-card"}
              onClick={() => {
                onSelectArea(area.areaId);
                onSelectBuilding(null);
              }}
            >
              <strong>{area.areaName}</strong>
              <span>
                {buildings.length} buildings · {customers} customers
              </span>
            </button>
          );
        })}
      </div>
      <div className="building-grid">
        {visibleBuildings.map((building) => (
          <article className="panel building-card" key={building.buildingId}>
            <div>
              <small>{building.areaName}</small>
              <h3>{building.buildingName}</h3>
            </div>
            <div className="building-card-stats">
              <p>
                <span>Customers</span>
                <b>{building.activeCustomers}</b>
              </p>
              <p>
                <span>Expected</span>
                <b>{money(building.expectedRevenue)}</b>
              </p>
              <p>
                <span>Collected</span>
                <b>{money(building.collected)}</b>
              </p>
              <p>
                <span>Outstanding</span>
                <b>{money(building.outstanding)}</b>
              </p>
            </div>
            <button className="send-button" onClick={() => onSelectBuilding(building.buildingId)}>
              View building
            </button>
          </article>
        ))}
      </div>
      {selectedAreaId && (
        <button
          className="secondary location-add-building"
          onClick={() => onAddBuilding(selectedAreaId)}
        >
          + Add building to this area
        </button>
      )}
    </section>
  );
}
