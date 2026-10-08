"use client";

import { useState } from "react";

import { Badge, YesNo } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Field, FormError, Input, Select, useForm } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader, SearchInput, Toolbar } from "@/components/ui/Page";
import { EmptyState, ErrorState, Loading, Notice } from "@/components/ui/States";
import { usersApi } from "@/lib/api/insight";
import type { Role, ShopUser, UserCreate } from "@/lib/api/types";
import { useApiMutation } from "@/lib/hooks/useApiMutation";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/lib/auth/AuthProvider";
import { titleCase } from "@/lib/format";

/**
 * The shop's staff accounts.
 *
 * **Roles are what make somebody staff**, and the `is_staff` column is not: the
 * server's gate is "any role other than CUSTOMER", and the column is writable
 * through this very screen, so a flag a caller can set is not something to hang
 * "who may read the shop's books" on. A technician created without the box ticked
 * is still staff, and the interface says so rather than implying otherwise.
 *
 * Every write is gated on the permission the API enforces: `users:write` to create
 * or edit, `users:manage` to deactivate. Deactivating is a soft delete — the row
 * survives with `is_active` false, which is what keeps its name on old invoices and
 * audit entries.
 */
const ROLES: Role[] = ["OWNER", "SERVICE_ADVISOR", "TECHNICIAN", "PARTS_STAFF", "CUSTOMER"];

/** Roles are not statuses, so this is the one place a role gets its own colour. */
const ROLE_TONES: Record<string, "neutral" | "info" | "progress" | "warning"> = {
  OWNER: "warning",
  SERVICE_ADVISOR: "info",
  TECHNICIAN: "progress",
  PARTS_STAFF: "neutral",
  CUSTOMER: "neutral",
};

export default function StaffPage() {
  const { can, user } = useSession();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ShopUser | null>(null);

  const permitted = can("users:read");
  const writable = can("users:write");

  const query = useApiQuery(
    () =>
      usersApi.list({
        page,
        size: 25,
        search: search || undefined,
        is_active: active === "" ? undefined : active === "active",
      }),
    [page, search, active],
    { enabled: permitted },
  );

  const columns: Column<ShopUser>[] = [
    {
      key: "name",
      header: "Name",
      render: (u) => (
        <div>
          <span className="font-medium text-ink-900">
            {u.first_name} {u.last_name}
          </span>
          {user && u.id === user.id ? (
            <span className="ml-2 text-xs text-ink-500">(you)</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (u) => <span className="text-sm text-ink-700">{u.email}</span>,
    },
    {
      key: "roles",
      header: "Roles",
      render: (u) =>
        u.roles.length === 0 ? (
          <span className="text-ink-400">No role</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {u.roles.map((role) => (
              <Badge key={role} tone={ROLE_TONES[role] ?? "neutral"}>
                {role}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      key: "active",
      header: "Active",
      render: (u) => <YesNo value={u.is_active} trueLabel="Active" falseLabel="Deactivated" />,
    },
    {
      key: "staff",
      header: "Staff flag",
      render: (u) => (
        <span title="Recorded on the account. Access follows the roles, not this column.">
          <YesNo value={u.is_staff} />
        </span>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (u) => <span className="text-sm text-ink-600">{u.phone ?? "—"}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle={query.data ? `${query.data.meta.total} account(s)` : "Accounts that can sign in"}
        actions={
          writable ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              New user
            </Button>
          ) : null
        }
      />

      {!permitted ? (
        <Notice tone="danger">
          Reading the staff list needs users access. Ask the owner for it.
        </Notice>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-600">
            Staffness follows the role list, not the staff flag:{" "}
            <span className="font-medium text-ink-800">CUSTOMER</span> is the only role that
            is not staff. The flag is recorded as given and shown for what it is.
          </p>

          <Card padded={false}>
            <Toolbar>
              <SearchInput
                value={search}
                onChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
                placeholder="Name, email or phone"
                className="min-w-64 flex-1"
              />
              <Select
                value={active}
                onChange={(event) => {
                  setActive(event.target.value);
                  setPage(1);
                }}
                className="w-40"
                aria-label="Active accounts"
              >
                <option value="">Any account</option>
                <option value="active">Active only</option>
                <option value="inactive">Deactivated only</option>
              </Select>
            </Toolbar>

            {query.loading && query.initial ? (
              <Loading />
            ) : query.error ? (
              <div className="p-4">
                <ErrorState error={query.error} onRetry={query.refetch} />
              </div>
            ) : !query.data || query.data.data.length === 0 ? (
              <EmptyState
                title={search ? "No account matches that" : "No accounts yet"}
                description={
                  search
                    ? "Try part of a name, an email address or a phone number."
                    : "Create the first one to give somebody access to the shop."
                }
              />
            ) : (
              <>
                <DataTable
                  rows={query.data.data}
                  columns={columns}
                  rowKey={(u) => u.id}
                  onRowClick={writable ? (u) => setEditing(u) : undefined}
                />
                <Pagination
                  page={query.data.meta.page}
                  pages={query.data.meta.pages}
                  total={query.data.meta.total}
                  onPage={setPage}
                />
              </>
            )}
          </Card>

          {writable ? null : (
            <p className="mt-3 text-xs text-ink-500">
              You can read this list but not change it — editing accounts needs users:write.
            </p>
          )}
        </>
      )}

      <NewUserModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          query.refetch();
        }}
      />

      {editing ? (
        <EditUserModal
          key={editing.id}
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            query.refetch();
          }}
        />
      ) : null}
    </>
  );
}

function RoleCheckboxes({
  value,
  onChange,
}: {
  value: Role[];
  onChange: (next: Role[]) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-medium tracking-wide text-ink-600 uppercase">
        Roles
      </legend>
      <div className="space-y-1.5">
        {ROLES.map((role) => (
          <label key={role} className="flex items-center gap-2 text-sm text-ink-800">
            <input
              type="checkbox"
              checked={value.includes(role)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, role]
                    : value.filter((existing) => existing !== role),
                )
              }
              className="size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            <span>{titleCase(role)}</span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-500">
        Saving replaces the whole set. Anyone but CUSTOMER is staff.
      </p>
    </fieldset>
  );
}

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: ShopUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { can, user: self } = useSession();
  const [roles, setRoles] = useState<Role[]>(user.roles as Role[]);
  const [localError, setLocalError] = useState<string | null>(null);

  const form = useForm({
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone ?? "",
    is_active: user.is_active,
    is_staff: user.is_staff,
  });

  const save = useApiMutation(() =>
    usersApi.update(user.id, {
      first_name: form.values.first_name,
      last_name: form.values.last_name,
      email: form.values.email,
      phone: form.values.phone || null,
      is_active: form.values.is_active,
      is_staff: form.values.is_staff,
      roles,
    }),
  );
  const deactivate = useApiMutation(() => usersApi.remove(user.id));

  // The server refuses to deactivate your own account, so the control is withheld
  // rather than offered and then answered with an error.
  const ownAccount = self?.id === user.id;
  const canDeactivate = can("users:manage") && !ownAccount;

  async function submit() {
    setLocalError(null);
    if (form.missing(["first_name", "last_name", "email"]).length > 0) {
      setLocalError("A first name, a last name and an email address are all required.");
      return;
    }
    if (!form.values.email.includes("@")) {
      setLocalError("That email address is not valid.");
      return;
    }
    if (roles.length === 0) {
      setLocalError("Give the account at least one role — an account with none can do nothing.");
      return;
    }
    const updated = await save.run();
    if (updated) onSaved();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${user.first_name} ${user.last_name}`}
      description="Changing a role takes effect the next time this person loads the shop."
      width="max-w-xl"
      footer={
        <>
          {can("users:manage") ? (
            <Button
              variant="danger"
              className="mr-auto"
              disabled={!canDeactivate}
              title={ownAccount ? "You cannot deactivate your own account" : undefined}
              pending={deactivate.pending}
              onClick={() => {
                if (!confirm("Deactivate this account? Their name stays on the records they touched.")) {
                  return;
                }
                deactivate.run().then((result) => {
                  if (result !== null) onSaved();
                });
              }}
            >
              Deactivate
            </Button>
          ) : null}
          <Button onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={save.pending} onClick={() => void submit()}>
            Save
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="space-y-3"
      >
        <FormError error={save.error ?? deactivate.error} />
        {localError ? <Notice tone="danger">{localError}</Notice> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" required>
            <Input
              value={form.values.first_name}
              onChange={(e) => form.set("first_name", e.target.value)}
            />
          </Field>
          <Field label="Last name" required>
            <Input
              value={form.values.last_name}
              onChange={(e) => form.set("last_name", e.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email" required hint="Must not already belong to another account">
            <Input
              type="email"
              value={form.values.email}
              onChange={(e) => form.set("email", e.target.value)}
            />
          </Field>
          <Field label="Phone">
            <Input value={form.values.phone} onChange={(e) => form.set("phone", e.target.value)} />
          </Field>
        </div>

        <RoleCheckboxes value={roles} onChange={setRoles} />

        <label className="flex items-center gap-2 text-sm text-ink-800">
          <input
            type="checkbox"
            checked={form.values.is_active}
            onChange={(event) => form.set("is_active", event.target.checked)}
            className="size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
          Account is active
        </label>
        <label className="flex items-start gap-2 text-sm text-ink-800">
          <input
            type="checkbox"
            checked={form.values.is_staff}
            onChange={(event) => form.set("is_staff", event.target.checked)}
            className="mt-0.5 size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
          <span>
            Staff flag
            <span className="block text-xs text-ink-500">
              Recorded as given. This is not what grants access — the role list above is.
            </span>
          </span>
        </label>

        {ownAccount ? (
          <Notice tone="info">
            This is your own account, so it cannot be deactivated from here. Changing your
            own roles can take away your own access.
          </Notice>
        ) : null}
      </form>
    </Modal>
  );
}

function NewUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const form = useForm({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    phone: "",
    is_active: true,
    is_staff: true,
  });

  const create = useApiMutation((body: UserCreate) => usersApi.create(body));

  async function submit() {
    setLocalError(null);
    if (form.missing(["first_name", "last_name", "email", "password"]).length > 0) {
      setLocalError("A first name, a last name, an email address and a password are all required.");
      return;
    }
    if (!form.values.email.includes("@")) {
      setLocalError("That email address is not valid.");
      return;
    }
    if (form.values.password.length < 8) {
      setLocalError("A password must be at least 8 characters.");
      return;
    }
    if (roles.length === 0) {
      setLocalError("Give the account at least one role — an account with none can do nothing.");
      return;
    }
    const created = await create.run({
      first_name: form.values.first_name,
      last_name: form.values.last_name,
      email: form.values.email,
      password: form.values.password,
      phone: form.values.phone || null,
      is_active: form.values.is_active,
      is_staff: form.values.is_staff,
      roles,
    });
    if (created) {
      form.reset();
      setRoles([]);
      onCreated();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New user"
      description="A shop account that can sign in, and the roles that decide what it can reach."
      width="max-w-xl"
      footer={
        <>
          <Button onClick={onClose} disabled={create.pending}>
            Cancel
          </Button>
          <Button variant="primary" pending={create.pending} onClick={() => void submit()}>
            Create account
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="space-y-3"
      >
        <FormError error={create.error} />
        {localError ? <Notice tone="danger">{localError}</Notice> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" required>
            <Input
              value={form.values.first_name}
              onChange={(e) => form.set("first_name", e.target.value)}
            />
          </Field>
          <Field label="Last name" required>
            <Input
              value={form.values.last_name}
              onChange={(e) => form.set("last_name", e.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email" required hint="Must not already belong to another account">
            <Input
              type="email"
              value={form.values.email}
              onChange={(e) => form.set("email", e.target.value)}
            />
          </Field>
          <Field label="Phone">
            <Input value={form.values.phone} onChange={(e) => form.set("phone", e.target.value)} />
          </Field>
        </div>
        <Field
          label="Password"
          required
          hint="At least 8 characters. Share it with them; they can change it afterwards."
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={form.values.password}
            onChange={(e) => form.set("password", e.target.value)}
          />
        </Field>

        <RoleCheckboxes value={roles} onChange={setRoles} />

        <label className="flex items-center gap-2 text-sm text-ink-800">
          <input
            type="checkbox"
            checked={form.values.is_active}
            onChange={(event) => form.set("is_active", event.target.checked)}
            className="size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
          Account is active
        </label>
        <label className="flex items-start gap-2 text-sm text-ink-800">
          <input
            type="checkbox"
            checked={form.values.is_staff}
            onChange={(event) => form.set("is_staff", event.target.checked)}
            className="mt-0.5 size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
          <span>
            Staff flag
            <span className="block text-xs text-ink-500">
              Recorded as given. This is not what grants access — the role list above is,
              and CUSTOMER is the only role that is not staff.
            </span>
          </span>
        </label>

        <Notice tone="info">
          An account holding only the CUSTOMER role is a portal login, not a member of staff.
          A new account needs a password typed here — there is no invitation link to send.
        </Notice>
      </form>
    </Modal>
  );
}