'use client'

import React, { createContext, useContext, useMemo, useState } from 'react'
import { accountingYears } from '@/lib/accounting-years'

// The accounting year is picked in the sidebar and consumed by the accounting
// page. Both live under Layout, so a context here is all the plumbing needed.
//
// Deliberately not held in the URL: the sidebar renders on every page, and
// calling useSearchParams() there would drop all 25 statically prerendered
// pages out of static rendering. The trade-off is that the selected year is
// not bookmarkable.
interface AccountingYearValue {
  year: number
  setYear: (year: number) => void
  years: number[]
}

const AccountingYearContext = createContext<AccountingYearValue | null>(null)

export function AccountingYearProvider({ children }: { children: React.ReactNode }) {
  const [year, setYear] = useState<number>(() => new Date().getFullYear())
  const years = useMemo(() => accountingYears(), [])
  const value = useMemo(() => ({ year, setYear, years }), [year, years])

  return (
    <AccountingYearContext.Provider value={value}>
      {children}
    </AccountingYearContext.Provider>
  )
}

export function useAccountingYear(): AccountingYearValue {
  const ctx = useContext(AccountingYearContext)
  if (!ctx) {
    throw new Error('useAccountingYear must be used within an AccountingYearProvider')
  }
  return ctx
}
