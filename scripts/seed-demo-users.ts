// Creates (or resets) the demo accounts through the Supabase admin API.
// Usage: pnpm db:seed   (reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from .env.local)
import { createClient } from "@supabase/supabase-js"

import { DEMO_PASSWORD, DEMO_USERS } from "../src/lib/demo-users.ts"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (e.g. in .env.local).")
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
if (listError) throw listError

for (const user of DEMO_USERS) {
  const existing = list.users.find((u) => u.email === user.email)
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      user_metadata: { full_name: user.full_name },
      app_metadata: { role: user.role },
    })
    if (error) throw error
    const { error: roleError } = await supabase
      .from("profiles")
      .update({ role: user.role, full_name: user.full_name })
      .eq("id", existing.id)
    if (roleError) throw roleError
    console.log(`reset   ${user.email} (${user.role})`)
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: user.full_name },
      app_metadata: { role: user.role },
    })
    if (error) throw error
    // The profile row is created by a trigger before app_metadata is written, so set the role explicitly.
    const { error: roleError } = await supabase.from("profiles").update({ role: user.role }).eq("id", data.user.id)
    if (roleError) throw roleError
    console.log(`created ${user.email} (${user.role})`)
  }
}
console.log(`\nDemo password: ${DEMO_PASSWORD}`)
