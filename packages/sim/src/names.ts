const FIRST = [
  'Mara', 'Lin', 'Theo', 'Iris', 'Cassian', 'Nia', 'Rey', 'Sade', 'Jun', 'Otis',
  'Vera', 'Felix', 'Petra', 'Arden', 'Ines', 'Kira', 'Lev', 'Mira', 'Onyx', 'Pax',
  'Quinn', 'Rina', 'Soren', 'Tova', 'Uri', 'Vex', 'Wren', 'Xan', 'Yara', 'Zane',
  'Ash', 'Bo', 'Cy', 'Dax', 'Eve', 'Faye', 'Gia', 'Hugo', 'Ivo', 'Joss',
  'Kai', 'Luca', 'Mei', 'Noor', 'Omar', 'Priya', 'Reza', 'Suri', 'Tariq', 'Uma',
];

const LAST = [
  'Vex', 'Chen', 'Holt', 'Vale', 'Ozin', 'Reyes', 'Quill', 'March', 'Brae', 'Stoke',
  'Carro', 'Devi', 'Esso', 'Fane', 'Greco', 'Hox', 'Iyer', 'Joud', 'Krane', 'Loma',
  'Mire', 'Nuro', 'Osei', 'Polk', 'Quan', 'Ruel', 'Sato', 'Tann', 'Umar', 'Vance',
  'Wend', 'Xeno', 'Yusu', 'Zorn', 'Aris', 'Boon', 'Calo', 'Dare', 'Even', 'Fross',
];

export function genName(rng: () => number): string {
  const first = FIRST[Math.floor(rng() * FIRST.length)]!;
  const last = LAST[Math.floor(rng() * LAST.length)]!;
  return `${first} ${last}`;
}

export function genCompanyName(rng: () => number): string {
  const heads = ['Riverside', 'Iron', 'Glass', 'Old', 'New', 'Black', 'Gold', 'Silver', 'Verde'];
  const tails = ['Foods', 'Works', 'Goods', 'Trading', 'Mills', 'Bar', 'Forge', 'House'];
  const h = heads[Math.floor(rng() * heads.length)]!;
  const t = tails[Math.floor(rng() * tails.length)]!;
  return `${h} ${t}`;
}
