import { Icone } from '../../compartilhado/Icone';

/** Exemplo de uma semana na agenda: eventos (confirmados ou provisórios) e escalas. */
const SEMANA_AGENDA = [
  { dia: 'Sex 12', itens: [{ tipo: 'evento', titulo: 'Casamento Silva', hora: '18:00–23:30', local: 'Optum' }] },
  { dia: 'Sáb 13', itens: [
    { tipo: 'escala', titulo: 'Escala · Festa Lima', hora: '17:00–00:00', local: '6 manobristas' },
    { tipo: 'provisorio', titulo: 'Festa Lima', hora: '19:00–23:00', local: 'Manifesto · a confirmar' },
  ] },
  { dia: 'Dom 14', itens: [{ tipo: 'evento', titulo: 'Formatura Beef', hora: '20:00–02:00', local: 'Beef' }] },
];

/** Um pedaço de agenda mostrando como os itens do Park Flash aparecem (não imita outro aplicativo). */
export function AgendaExemplo({ className = '' }: { className?: string }) {
  return (
    <figure className={`agenda__exemplo ${className}`} aria-label="Exemplo de como os eventos e as escalas aparecem na agenda">
      <figcaption className="agenda__exemplo-topo">
        <Icone nome="eventos" tamanho={16} />
        <span>Agenda Park Flash</span>
      </figcaption>
      <div className="agenda__semana">
        {SEMANA_AGENDA.map((d) => (
          <div key={d.dia} className="agenda__dia">
            <p className="agenda__dia-nome">{d.dia}</p>
            {d.itens.map((item) => (
              <div key={item.titulo} className={`agenda__item agenda__item--${item.tipo}`}>
                <strong>{item.titulo}</strong>
                <span>{item.hora}</span>
                <span>{item.local}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="agenda__legenda">
        <span className="agenda__chave agenda__chave--evento" />Confirmado
        <span className="agenda__chave agenda__chave--provisorio" />Provisório
        <span className="agenda__chave agenda__chave--escala" />Escala
      </p>
    </figure>
  );
}
