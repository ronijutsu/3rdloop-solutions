// Creates the real founder accounts through the Supabase admin API.
// Usage: pnpm db:seed:founders            creates missing accounts, leaves existing ones (and their passwords) alone
//        pnpm db:seed:founders -- --reset-passwords   sets everyone back to their starting password
//
// Starting passwords are random, generated once, and kept in .env.local (never committed) as
// FOUNDER_PASSWORD_<NAME>, so `pnpm db:reset` recreates the same ones. Founders change theirs in Settings.
import { randomBytes } from "node:crypto"
import { appendFileSync } from "node:fs"

import { createClient } from "@supabase/supabase-js"

const FOUNDERS = [
  { email: "ceo@3rdloopsolutions.com", full_name: "CEO", role: "admin" },
  { email: "cto@3rdloopsolutions.com", full_name: "CTO", role: "admin" },
  { email: "ron@3rdloopsolutions.com", full_name: "Ron", role: "founder" },
  { email: "rose@3rdloopsolutions.com", full_name: "Rose", role: "founder" },
  { email: "renz@3rdloopsolutions.com", full_name: "Renz", role: "founder" },
] as const

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (e.g. in .env.local).")
  process.exit(1)
}
const resetPasswords = process.argv.includes("--reset-passwords")

/** e.g. "Loop-k7Qm-2xVb-9Rtd": 3 random groups (~71 bits), easy to read aloud. */
function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(12)
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length])
  return `Loop-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`
}

const envName = (email: string) => `FOUNDER_PASSWORD_${email.split("@")[0].toUpperCase()}`

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
if (listError) throw listError

const summary: { email: string; role: string; password: string; status: string }[] = []

for (const founder of FOUNDERS) {
  const name = envName(founder.email)
  let password = process.env[name]
  if (!password) {
    password = generatePassword()
    appendFileSync(".env.local", `\n${name}=${password}`)
  }

  const existing = list.users.find((u) => u.email === founder.email)
  let id: string
  let status: string
  if (existing) {
    id = existing.id
    const { error } = await supabase.auth.admin.updateUserById(id, {
      ...(resetPasswords ? { password } : {}),
      app_metadata: { role: founder.role },
    })
    if (error) throw error
    status = resetPasswords ? "password reset" : "already exists (password unchanged)"
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: founder.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: founder.full_name },
      app_metadata: { role: founder.role },
    })
    if (error) throw error
    id = data.user.id
    status = "created"
  }
  // The profile row is created by a trigger before app_metadata is written, so set the role explicitly.
  const { error: roleError } = await supabase.from("profiles").update({ role: founder.role }).eq("id", id)
  if (roleError) throw roleError
  summary.push({ email: founder.email, role: founder.role, password, status })
}

console.table(summary)
console.log("Starting passwords are stored in .env.local. Ask everyone to change theirs in Settings → Your profile.")
