import { describe, expect, it } from 'vitest'
import { coHostPlan } from './coHosts'

describe('coHostPlan', () => {
  it('keeps only co-hosts who are guests of the meeting', () => {
    const plan = coHostPlan({ guests: ['a@x.sn', 'b@x.sn'], requested: ['b@x.sn', 'z@x.sn'], current: [] })
    expect(plan.coHosts).toEqual(['b@x.sn'])
  })

  it('lists who gains and who loses the role', () => {
    const plan = coHostPlan({
      guests: ['a@x.sn', 'b@x.sn', 'c@x.sn'],
      requested: ['b@x.sn', 'c@x.sn'],
      current: ['a@x.sn', 'b@x.sn'],
    })
    expect(plan.promoted).toEqual(['c@x.sn'])
    expect(plan.demoted).toEqual(['a@x.sn'])
  })

  it('demotes a co-host removed from the guest list', () => {
    const plan = coHostPlan({ guests: ['b@x.sn'], requested: ['a@x.sn', 'b@x.sn'], current: ['a@x.sn', 'b@x.sn'] })
    expect(plan.coHosts).toEqual(['b@x.sn'])
    expect(plan.demoted).toEqual(['a@x.sn'])
    expect(plan.promoted).toEqual([])
  })

  it('compares addresses case-insensitively', () => {
    const plan = coHostPlan({ guests: ['awa@x.sn'], requested: ['AWA@X.SN'], current: [] })
    expect(plan.coHosts).toEqual(['awa@x.sn'])
  })

  it('changes nothing when the request is absent', () => {
    const plan = coHostPlan({ guests: ['a@x.sn', 'b@x.sn'], requested: undefined, current: ['a@x.sn'] })
    expect(plan).toEqual({ coHosts: ['a@x.sn'], promoted: [], demoted: [] })
  })
})
