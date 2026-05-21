import { describe, expect, it } from 'vitest'
import fixture from './fixtures/ares-ideabox.json'
import { mapAresResponse } from '../server/utils/ares'

describe('mapAresResponse', () => {
  const company = mapAresResponse(fixture)

  it('maps core identity fields', () => {
    expect(company.ico).toBe('02823519')
    expect(company.name).toBe('ideabox s.r.o.')
    expect(company.dic).toBe('CZ02823519')
  })

  it('maps the legal form code to a label', () => {
    expect(company.legalFormCode).toBe('112')
    expect(company.legalForm).toBe('Společnost s ručením omezeným')
  })

  it('maps founding date and seat address', () => {
    expect(company.foundedDate).toBe('2014-03-26')
    expect(company.address).toBe('Minická 376/2, Čimice, 18100 Praha 8')
  })

  it('derives an active status from the primary register', () => {
    expect(company.status).toBe('Aktivní')
  })

  it('returns null dic when missing', () => {
    const noDic = mapAresResponse({ ...fixture, dic: undefined })
    expect(noDic.dic).toBeNull()
  })

  it('derives Zaniklý status from a terminated register entry', () => {
    const terminated = mapAresResponse({ ...fixture, primarniZdroj: 'ros', seznamRegistraci: { stavZdrojeRos: 'ZANIKLY' } })
    expect(terminated.status).toBe('Zaniklý')
  })

  it('returns Neznámý when register info is missing', () => {
    const unknown = mapAresResponse({ ...fixture, primarniZdroj: undefined, seznamRegistraci: undefined })
    expect(unknown.status).toBe('Neznámý')
  })
})
