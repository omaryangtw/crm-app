"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown } from "lucide-react";
import {
  bindStaffUser,
  unbindStaffUser,
  getUnboundUsers,
} from "@/app/_lib/actions/binding-actions";

interface StaffBindingSectionProps {
  staffId: number;
  boundUser: { id: number; email: string } | null;
}

export default function StaffBindingSection({
  staffId,
  boundUser,
}: StaffBindingSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Popover + Command state for unbound user selector
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    id: number;
    email: string;
  } | null>(null);
  const [unboundUsers, setUnboundUsers] = useState<
    { id: number; email: string }[]
  >([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Load unbound users when popover opens
  const loadUnboundUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const users = await getUnboundUsers();
      setUnboundUsers(users);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadUnboundUsers();
    }
  }, [open, loadUnboundUsers]);

  // Clear message after 3 seconds
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const handleUnbind = () => {
    startTransition(async () => {
      const result = await unbindStaffUser(staffId);
      if (result.success) {
        setMessage({ type: "success", text: "已成功解除綁定" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: result.error ?? "操作失敗" });
      }
    });
  };

  const handleBind = () => {
    if (!selectedUser) return;
    startTransition(async () => {
      const result = await bindStaffUser(staffId, selectedUser.id);
      if (result.success) {
        setMessage({ type: "success", text: "已成功綁定帳號" });
        setSelectedUser(null);
        router.refresh();
      } else {
        setMessage({ type: "error", text: result.error ?? "操作失敗" });
      }
    });
  };

  const handleSelect = (user: { id: number; email: string }) => {
    setSelectedUser(user);
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>帳號綁定</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {boundUser ? (
          /* Bound state: show email + unbind button */
          <div className="flex items-center justify-between">
            <div>
              <label className="mb-1 block text-sm font-medium">
                綁定帳號
              </label>
              <p className="text-sm">{boundUser.email}</p>
            </div>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={handleUnbind}
            >
              {isPending ? "處理中…" : "解除綁定"}
            </Button>
          </div>
        ) : (
          /* Unbound state: show selector + bind button */
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                綁定帳號
              </label>
              <p className="text-sm text-muted-foreground">尚未綁定</p>
            </div>
            <div className="space-y-3">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-full justify-between font-normal"
                    />
                  }
                >
                  <span className="truncate">
                    {selectedUser
                      ? selectedUser.email
                      : "搜尋帳號 email..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--anchor-width)] p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="搜尋帳號 email..." />
                    <CommandList>
                      {loadingUsers && (
                        <CommandEmpty>載入中...</CommandEmpty>
                      )}
                      {!loadingUsers && unboundUsers.length === 0 && (
                        <CommandEmpty>沒有可綁定的帳號</CommandEmpty>
                      )}
                      <CommandGroup>
                        {unboundUsers.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={user.email}
                            onSelect={() => handleSelect(user)}
                          >
                            {user.email}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button
                disabled={!selectedUser || isPending}
                onClick={handleBind}
              >
                {isPending ? "處理中…" : "確認綁定"}
              </Button>
            </div>
          </div>
        )}

        {/* Success / Error message */}
        {message && (
          <p
            className={
              message.type === "success"
                ? "text-sm text-primary"
                : "text-sm text-destructive"
            }
          >
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
