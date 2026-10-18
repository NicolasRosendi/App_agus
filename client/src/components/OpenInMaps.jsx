import { nativeMapLinks } from '../lib/nativeMaps.js';

// Botones "Abrir en…" para navegar con la app de mapas del celular.
export default function OpenInMaps({ dest, origin }) {
  const [main, ...rest] = nativeMapLinks(dest, origin);
  return (
    <div className="open-maps">
      <a className="btn ghost sm" href={main.url} target="_blank" rel="noopener noreferrer"><span>Abrir en {main.label}</span></a>
      <div className="open-maps-rest">
        {rest.map((l) => <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>)}
      </div>
    </div>
  );
}
