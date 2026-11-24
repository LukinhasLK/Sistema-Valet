import './logo.scss';

/** `escuro`: usa o branco no "PARK" quando o logo está sobre fundo escuro. */
export function Logo({ escuro = false, tamanho = 20 }: { escuro?: boolean; tamanho?: number }) {
  return (
    <pf-logo>
      <span className={`logo${escuro ? ' logo--dark' : ''}`} style={{ fontSize: tamanho }}>
        <img className="logo__mark" src="/favicon.svg" alt="" width={32} height={32} />
        <span className="logo__text"><span className="logo__park">PARK</span><span className="logo__flash">FLASH</span></span>
      </span>
    </pf-logo>
  );
}
