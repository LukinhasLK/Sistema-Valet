import { urlDoLink } from './calendario';

describe('calendario', () => {
  it('monta o endereço público do link de agenda', () => {
    expect(urlDoLink('abc_DEF-123', 'https://hitmanpark.com')).toBe('https://hitmanpark.com/api/agenda/abc_DEF-123.ics');
  });

  it('não duplica a barra da origem', () => {
    expect(urlDoLink('tok', 'https://hitmanpark.com/')).toBe('https://hitmanpark.com/api/agenda/tok.ics');
  });
});
