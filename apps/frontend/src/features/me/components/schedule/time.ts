export const pad = (n: number) => String(n).padStart(2, '0')
export const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const toTimeInput = (d: Date) =>
  `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Next half hour from now, as Google Agenda proposes. */
export const nextSlot = () => {
  const d = new Date()
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60)
  return d
}
