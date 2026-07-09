export interface NavLink {
  href: string;
  label: string;
}

export const navLinks: NavLink[] = [
  { href: "/assessment", label: "Assessment" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/team", label: "Team" },
];
