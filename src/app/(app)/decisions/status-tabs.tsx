"use client"

import { useRouter } from "next/navigation"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function StatusTabs({ view }: { view: string }) {
  const router = useRouter()
  return (
    <Tabs value={view} onValueChange={(v) => router.replace(`/decisions?view=${v}`)}>
      <TabsList>
        <TabsTrigger value="open">Open</TabsTrigger>
        <TabsTrigger value="decided">Decided</TabsTrigger>
        <TabsTrigger value="all">All</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
