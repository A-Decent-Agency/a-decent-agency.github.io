// Visual metaphors identify public projects; they never establish delivery or physical amenities.
const ART = [
  ['TheJollyLaMa/BigNuten_Vanilla', 'Training & nutrition campus', 'Gym frontage, outdoor strength and movement grounds, and a nutrition stop.'],
  ['A-Decent-Agency/a-decent-agency.github.io', 'Agency Town Hall', 'A civic meeting place for the shared planning office.'],
  ['TheJollyLaMa/DecentPilgrimages', 'Pilgrimage temple', 'A sanctuary and gathering place beside the proposed journey tower.'],
  ['A-Decent-Agency/DecentJukebox', 'Jukebox museum', 'A music museum with retro jukeboxes and a telephone booth.'],
  ['TheJollyLaMa/DecentBusking', 'Concert venue & busking corner', 'A large performance entrance with a small street-performance corner.'],
  ['TheJollyLaMa/DecentInvoice', 'Invoice business office', 'A business frontage for invoices and professional exchange.'],
  ['TheJollyLaMa/DecentEscrow', 'Escrow business office', 'A restrained accounting-office frontage, not a custody guarantee.'],
  ['TheJollyLaMa/Decent_NDA', 'NDA law office', 'A legal-office metaphor, not legal advice or verified protection.'],
  ['TheJollyLaMa/DecentMarket', 'Market square', 'Colorful stalls and a shared trading courtyard.'],
  ['TheJollyLaMa/DecentHead', 'Shared gateway', 'An entrance pavilion for the reusable application header.'],
  ['A-Decent-Agency/DBuskRadio', 'Radio listening station', 'A broadcast-style booth and listening courtyard for the opt-in radio widget.'],
  ['A-Decent-Agency/DVert', 'Advertising design studio', 'A modular media studio with exhibition panels for the reusable advertising widget.']
];

export function campusArt(project) {
  if (!project || project.entityId || typeof project.repository !== 'string') return null;
  const entry = ART.find(([repository]) => repository.toLowerCase() === project.repository.toLowerCase());
  return entry ? { repository: entry[0], name: entry[1], description: entry[2] } : null;
}
