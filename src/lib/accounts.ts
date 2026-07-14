export const PRESENTERS: { firstName: string; lastName: string }[] = [
  { firstName: "Stan", lastName: "De Cock" },
  { firstName: "Conan", lastName: "Heeren" },
  { firstName: "Jaime", lastName: "Lauryssen" },
  { firstName: "Martha", lastName: "Tubex" },
  { firstName: "Mina", lastName: "Coornaert" },
  { firstName: "Kasper", lastName: "Van Ryckeghem" },
  { firstName: "Sarah", lastName: "Van Landeghem" },
  { firstName: "Emma", lastName: "Van De Velde" },
  { firstName: "Emile", lastName: "De Buyckere" },
  { firstName: "Hanne", lastName: "Speelman" },
  { firstName: "Jackie", lastName: "Moreau" },
  { firstName: "Joren", lastName: "Van Ryckeghem" },
  { firstName: "Lars", lastName: "Dehairs" },
  { firstName: "Louise", lastName: "Gryp" },
  { firstName: "Mees", lastName: "van Medegael" },
  { firstName: "Bas", lastName: "Bortolin" },
  { firstName: "Elisabeth", lastName: "Cartreul" },
  { firstName: "Louise", lastName: "Demeyere" },
  { firstName: "Lars", lastName: "Dobbelaere" },
];

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function accountEmail(firstName: string, lastName: string) {
  return `${slugify(firstName)}.${slugify(lastName)}@boenkerz.local`;
}

export const ADMIN_EMAIL = "admin@boenkerz.local";

export function defaultPassword(firstName: string) {
  return `ikben${firstName.toLowerCase()}`;
}
