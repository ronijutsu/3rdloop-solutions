// Demo accounts, one per built-in role. Created by `pnpm db:seed` and listed on
// the login page when DEMO_MODE=true. Never enable DEMO_MODE on a real deployment.

export const DEMO_PASSWORD = "demo-3rdloop"

export const DEMO_USERS = [
  { email: "admin@3rdloop.demo", full_name: "Alex Admin", role: "admin", roleName: "Admin" },
  { email: "founder@3rdloop.demo", full_name: "Fiona Founder", role: "founder", roleName: "Founder" },
  { email: "cofounder@3rdloop.demo", full_name: "Sam Cofounder", role: "founder", roleName: "Founder" },
  { email: "member@3rdloop.demo", full_name: "Maya Member", role: "member", roleName: "Team member" },
  { email: "viewer@3rdloop.demo", full_name: "Victor Viewer", role: "viewer", roleName: "Viewer" },
] as const
