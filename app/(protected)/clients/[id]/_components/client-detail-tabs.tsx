"use client";

import { useEffect, useState } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { formatTabLabel } from "@/app/_lib/utils/search-utils";

const TABS = [
  { id: "cases", label: "案件紀錄" },
  { id: "contacts", label: "通聯紀錄" },
  { id: "family", label: "家庭關係" },
  { id: "history", label: "變更歷史" },
] as const;

type TabId = (typeof TABS)[number]["id"];
const VALID_TAB_IDS = new Set<string>(TABS.map((t) => t.id));
const DEFAULT_TAB: TabId = "cases";

interface ClientDetailTabsProps {
  clientId: number;
  sessionStaffId: number | null;
  counts: { cases: number; contacts: number; family: number };
  casesContent: React.ReactNode;
  contactsContent: React.ReactNode;
  familyContent: React.ReactNode;
  historyContent: React.ReactNode;
}

function getTabLabel(tab: (typeof TABS)[number], counts: ClientDetailTabsProps["counts"]): string {
  switch (tab.id) {
    case "cases":
      return formatTabLabel(tab.label, counts.cases);
    case "contacts":
      return formatTabLabel(tab.label, counts.contacts);
    case "family":
      return formatTabLabel(tab.label, counts.family);
    case "history":
      return tab.label;
  }
}

function readHashTab(): TabId {
  if (typeof window === "undefined") return DEFAULT_TAB;
  const hash = window.location.hash.replace("#", "");
  return VALID_TAB_IDS.has(hash) ? (hash as TabId) : DEFAULT_TAB;
}

export default function ClientDetailTabs({
  counts,
  casesContent,
  contactsContent,
  familyContent,
  historyContent,
}: ClientDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>(DEFAULT_TAB);

  // Read hash on mount to set initial tab
  useEffect(() => {
    setActiveTab(readHashTab());
  }, []);

  function handleTabChange(value: unknown) {
    const tab = value as TabId;
    setActiveTab(tab);
    window.history.replaceState(null, "", `#${tab}`);
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="w-full">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {getTabLabel(tab, counts)}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="cases">{casesContent}</TabsContent>
      <TabsContent value="contacts">{contactsContent}</TabsContent>
      <TabsContent value="family">{familyContent}</TabsContent>
      <TabsContent value="history">{historyContent}</TabsContent>
    </Tabs>
  );
}
