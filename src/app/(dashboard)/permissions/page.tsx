"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Layers, Lock, Save, Search } from "lucide-react";

import { ALLOWED_PERMISSIONS, type PermissionFlags } from "@/constants/permissions";

type Role = { id: string; name: string };
type LeftMenu = {
  id: string;
  menuKey: string;
  name: string;
  isParent: boolean;
  parentId: string | null;
};

const EMPTY_FLAGS: PermissionFlags = {
  List: false,
  Add: false,
  Edit: false,
  View: false,
  Delete: false,
  StatusChange: false,
  Approve: false,
};

function isRowFullySelected(flags: PermissionFlags) {
  return ALLOWED_PERMISSIONS.every((action) => flags[action]);
}

function PermissionsContent() {
  const searchParams = useSearchParams();
  const preselectedRoleId = searchParams.get("roleId");

  const [roles, setRoles] = useState<Role[]>([]);
  const [menus, setMenus] = useState<LeftMenu[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [permissionsByMenuKey, setPermissionsByMenuKey] = useState<Record<string, PermissionFlags>>({});
  const [search, setSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [rolesResponse, menusResponse] = await Promise.all([fetch("/api/roles"), fetch("/api/left-menu")]);
        const rolesResult = await rolesResponse.json();
        const menusResult = await menusResponse.json();
        if (!rolesResult.success) throw new Error(rolesResult.message);
        if (!menusResult.success) throw new Error(menusResult.message);
        setRoles(rolesResult.data);
        setMenus(menusResult.data);
        if (preselectedRoleId && rolesResult.data.some((role: Role) => role.id === preselectedRoleId)) {
          setSelectedRoleId(preselectedRoleId);
        }
      } catch {
        setError("Failed to load roles and menus.");
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedRoleId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale permissions when no role is selected
      setPermissionsByMenuKey({});
      return;
    }
    setIsLoadingPermissions(true);
    setSaveMessage(null);
    fetch(`/api/role-permissions/${selectedRoleId}`)
      .then((response) => response.json())
      .then((result) => {
        if (result.success) setPermissionsByMenuKey(result.data);
      })
      .finally(() => setIsLoadingPermissions(false));
  }, [selectedRoleId]);

  const groups = useMemo(() => {
    const parents = menus.filter((menu) => menu.isParent);
    const standalone = menus.filter((menu) => !menu.isParent && !menu.parentId);
    const term = search.toLowerCase();

    const matches = (menu: LeftMenu) =>
      menu.name.toLowerCase().includes(term) || menu.menuKey.toLowerCase().includes(term);

    const parentGroups = parents
      .map((parent) => ({
        key: parent.id,
        label: parent.name,
        rows: menus.filter((menu) => menu.parentId === parent.id && matches(menu)),
      }))
      .filter((group) => group.rows.length > 0 || term === "");

    const standaloneRows = standalone.filter(matches);

    return { parentGroups, standaloneRows };
  }, [menus, search]);

  function getFlags(menuKey: string): PermissionFlags {
    return permissionsByMenuKey[menuKey] ?? EMPTY_FLAGS;
  }

  function setFlags(menuKey: string, flags: PermissionFlags) {
    setPermissionsByMenuKey((prev) => ({ ...prev, [menuKey]: flags }));
  }

  function toggleAction(menuKey: string, action: keyof PermissionFlags) {
    const flags = getFlags(menuKey);
    setFlags(menuKey, { ...flags, [action]: !flags[action] });
  }

  function toggleRow(menuKey: string) {
    const allSelected = isRowFullySelected(getFlags(menuKey));
    const next = ALLOWED_PERMISSIONS.reduce(
      (acc, action) => ({ ...acc, [action]: !allSelected }),
      {} as PermissionFlags,
    );
    setFlags(menuKey, next);
  }

  function toggleGroup(menuKeys: string[]) {
    const allSelected = menuKeys.every((menuKey) => isRowFullySelected(getFlags(menuKey)));
    const next = ALLOWED_PERMISSIONS.reduce(
      (acc, action) => ({ ...acc, [action]: !allSelected }),
      {} as PermissionFlags,
    );
    setPermissionsByMenuKey((prev) => {
      const updated = { ...prev };
      menuKeys.forEach((menuKey) => {
        updated[menuKey] = next;
      });
      return updated;
    });
  }

  const allMenuKeys = useMemo(
    () => [...groups.parentGroups.flatMap((group) => group.rows.map((row) => row.menuKey)), ...groups.standaloneRows.map((row) => row.menuKey)],
    [groups],
  );
  const isAllSelected = allMenuKeys.length > 0 && allMenuKeys.every((menuKey) => isRowFullySelected(getFlags(menuKey)));

  async function handleSave() {
    if (!selectedRoleId) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await Promise.all(
        allMenuKeys.map((menuKey) =>
          fetch("/api/role-permissions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roleId: selectedRoleId, menuKey, permissions: getFlags(menuKey) }),
          }),
        ),
      );
      setSaveMessage("Permissions saved successfully.");
    } catch {
      setSaveMessage("Failed to save permissions.");
    } finally {
      setIsSaving(false);
    }
  }

  function renderRow(menu: LeftMenu) {
    const flags = getFlags(menu.menuKey);
    return (
      <tr key={menu.id} className="transition-colors hover:bg-muted/30">
        <td className="px-6 py-3 font-medium text-foreground">
          {menu.name}
          <span className="ml-1.5 text-[10px] text-muted-foreground">{menu.menuKey}</span>
        </td>
        <td className="px-3 py-3 text-center">
          <input
            type="checkbox"
            checked={isRowFullySelected(flags)}
            onChange={() => toggleRow(menu.menuKey)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
        </td>
        {ALLOWED_PERMISSIONS.map((action) => (
          <td key={action} className="px-3 py-3 text-center">
            <input
              type="checkbox"
              checked={flags[action]}
              onChange={() => toggleAction(menu.menuKey, action)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
          </td>
        ))}
      </tr>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Permissions</h2>
          <p className="text-xs text-muted-foreground">Select a role, then choose what it can do per menu.</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!selectedRoleId || isSaving}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 rounded-[8px] border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="role" className="text-[11px] font-medium text-muted-foreground">
              Role
            </label>
            <select
              id="role"
              value={selectedRoleId}
              onChange={(event) => setSelectedRoleId(event.target.value)}
              className="w-56 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
            >
              <option value="">Select Role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="search" className="text-[11px] font-medium text-muted-foreground">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="search"
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search menu..."
                className="w-56 rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
              />
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs font-medium text-foreground">
          <input
            type="checkbox"
            checked={isAllSelected}
            disabled={!selectedRoleId || allMenuKeys.length === 0}
            onChange={() => toggleGroup(allMenuKeys)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          Select All
        </label>
      </div>

      {saveMessage ? (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500">{saveMessage}</p>
      ) : null}

      {isLoading ? (
        <div className="rounded-[8px] border border-border bg-card p-8 text-center text-xs text-muted-foreground shadow-sm">
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-[8px] border border-border bg-card p-8 text-center text-xs text-destructive shadow-sm">
          {error}
        </div>
      ) : !selectedRoleId ? (
        <div className="rounded-[8px] border border-border bg-card p-8 text-center text-xs text-muted-foreground shadow-sm">
          Select a role above to manage its permissions.
        </div>
      ) : isLoadingPermissions ? (
        <div className="rounded-[8px] border border-border bg-card p-8 text-center text-xs text-muted-foreground shadow-sm">
          Loading permissions…
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            Menu
          </div>

          {groups.parentGroups.map((group) => {
            const menuKeys = group.rows.map((row) => row.menuKey);
            const groupSelected = menuKeys.length > 0 && menuKeys.every((menuKey) => isRowFullySelected(getFlags(menuKey)));
            const isCollapsed = collapsedGroups[group.key];

            return (
              <div key={group.key} className="overflow-hidden rounded-[8px] border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border px-6 py-3">
                  <button
                    type="button"
                    onClick={() => setCollapsedGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                    className="flex items-center gap-2 text-xs font-semibold text-foreground"
                  >
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    {group.label}
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                  </button>
                  <label className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={groupSelected}
                      disabled={menuKeys.length === 0}
                      onChange={() => toggleGroup(menuKeys)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    Select All
                  </label>
                </div>
                {!isCollapsed ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border bg-muted/50 uppercase text-muted-foreground">
                        <tr>
                          <th className="px-6 py-3 font-medium">Menu</th>
                          <th className="px-3 py-3 text-center font-medium">Select</th>
                          {ALLOWED_PERMISSIONS.map((action) => (
                            <th key={action} className="px-3 py-3 text-center font-medium">
                              {action}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {group.rows.length === 0 ? (
                          <tr>
                            <td colSpan={ALLOWED_PERMISSIONS.length + 2} className="px-6 py-6 text-center text-muted-foreground">
                              No menu items in this section.
                            </td>
                          </tr>
                        ) : (
                          group.rows.map(renderRow)
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            );
          })}

          {groups.standaloneRows.length > 0 ? (
            <div className="overflow-hidden rounded-[8px] border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/50 uppercase text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3 font-medium">Menu</th>
                      <th className="px-3 py-3 text-center font-medium">Select</th>
                      {ALLOWED_PERMISSIONS.map((action) => (
                        <th key={action} className="px-3 py-3 text-center font-medium">
                          {action}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">{groups.standaloneRows.map(renderRow)}</tbody>
                </table>
              </div>
            </div>
          ) : null}

          {groups.parentGroups.length === 0 && groups.standaloneRows.length === 0 ? (
            <div className="rounded-[8px] border border-border bg-card p-8 text-center text-xs text-muted-foreground shadow-sm">
              No menu items match your search.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function PermissionsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-muted-foreground">Loading…</div>}>
      <PermissionsContent />
    </Suspense>
  );
}
