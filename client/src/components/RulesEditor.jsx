import { CATEGORIES } from '../lib/constants.js';

// Editor del motor de automatización de una juntada.
export default function RulesEditor({ rules, onChange }) {
  const set = (k, v) => onChange({ ...rules, [k]: v });
  const toggleCat = (c) => set('categories', rules.categories.includes(c) ? rules.categories.filter((x) => x !== c) : [...rules.categories, c]);
  return (
    <div>
      <label className="toggle">
        <div><b>Auto-aprobar</b><div className="muted" style={{ fontSize: 13 }}>Si cumple todo, entra sin que lo revises.</div></div>
        <input type="checkbox" checked={rules.autoApprove} onChange={(e) => set('autoApprove', e.target.checked)} />
        <span className="sw" />
      </label>
      <label className="toggle">
        <div><b>Modo estricto</b><div className="muted" style={{ fontSize: 13 }}>Si no cumple, se rechaza solo (sino va a tu cola).</div></div>
        <input type="checkbox" checked={rules.strict} onChange={(e) => set('strict', e.target.checked)} />
        <span className="sw" />
      </label>
      <label className="toggle">
        <div><b>Patente verificada</b><div className="muted" style={{ fontSize: 13 }}>Exigir auto con foto + patente.</div></div>
        <input type="checkbox" checked={rules.requireVerifiedCar} onChange={(e) => set('requireVerifiedCar', e.target.checked)} />
        <span className="sw" />
      </label>
      <label className="toggle">
        <div><b>Lista de espera</b><div className="muted" style={{ fontSize: 13 }}>Si se llena, encola y promueve sola cuando alguien se baja.</div></div>
        <input type="checkbox" checked={rules.waitlist} onChange={(e) => set('waitlist', e.target.checked)} />
        <span className="sw" />
      </label>
      <label className="field mt">
        <span className="label">Rep mínima: <b className="orange">{rules.minRep}</b></span>
        <input type="range" min="0" max="1000" step="10" value={rules.minRep} onChange={(e) => set('minRep', Number(e.target.value))} className="range" />
      </label>
      <div className="label mb">Categorías aceptadas (vacío = todas)</div>
      <div className="chips">
        {CATEGORIES.map((c) => <button type="button" key={c} className={`chip ${rules.categories.includes(c) ? 'on' : ''}`} onClick={() => toggleCat(c)}><span>{c}</span></button>)}
      </div>
      <label className="field mt">
        <span className="label">Crews de confianza (auto-aprueban, separadas por coma)</span>
        <input className="input" value={(rules.trustedCrews || []).join(', ')} onChange={(e) => set('trustedCrews', e.target.value.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean))} placeholder="NOCTURNOS, SUR KINGS" />
      </label>
    </div>
  );
}
