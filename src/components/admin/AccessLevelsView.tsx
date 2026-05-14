import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  UserPlus,
  Shield,
  Building2,
  Layers,
  Mail,
  Pencil,
  Ban,
  RotateCcw,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";
import {
  db,
  type UserRole,
  type AccessLevel,
} from "../../services/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { effectiveLevel } from "../../lib/rbac";
import {
  createUserViaSecondaryApp,
  listUserRoles,
  sendPasswordReset,
  updateUserRole,
  setUserRoleDisabled,
} from "../../services/userManagement";

interface Company {
  id: string;
  name: string;
}

interface Sector {
  id: string;
  name: string;
  companyId?: string;
}

const LEVEL_LABEL: Record<AccessLevel, string> = {
  L0: "L0 — Admin Adventure/Lidera",
  L1: "L1 — Owner do tenant",
  L2: "L2 — Gestor",
  L3: "L3 — Líder de setor",
};

const LEVEL_BADGE: Record<AccessLevel, string> = {
  L0: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  L1: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  L2: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  L3: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

export const AccessLevelsView = () => {
  const { user, userRole, level } = useAuth();
  const { companies } = useCompany();

  const myLevel = level;
  const canManage = myLevel === "L0" || myLevel === "L1";
  const tenantFilter = myLevel === "L0" ? null : userRole?.companyId ?? null;

  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [showDisabled, setShowDisabled] = useState(false);
  // uid em ação no momento (pra dar disabled em botões e evitar duplo-clique)
  const [pendingUid, setPendingUid] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listUserRoles(tenantFilter);
      setRoles(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Não foi possível carregar usuários: " + msg);
    } finally {
      setLoading(false);
    }
  }, [tenantFilter]);

  useEffect(() => {
    if (canManage) loadRoles();
    else setLoading(false);
  }, [canManage, loadRoles]);

  const companyById = useMemo(() => {
    const map: Record<string, string> = {};
    companies.forEach((c) => (map[c.id] = c.name));
    return map;
  }, [companies]);

  const visibleRoles = useMemo(
    () => roles.filter((r) => showDisabled || !r.disabled),
    [roles, showDisabled]
  );

  const handleResend = async (r: UserRole) => {
    if (pendingUid) return;
    setPendingUid(r.id);
    try {
      await sendPasswordReset(r.email);
      toast.success(`Email para redefinir senha reenviado para ${r.email}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Falha ao reenviar email: " + msg);
    } finally {
      setPendingUid(null);
    }
  };

  const handleEdit = (r: UserRole) => {
    setEditingRole(r);
    setShowForm(true);
  };

  const handleDisable = async (r: UserRole) => {
    if (pendingUid || !user) return;
    if (
      !window.confirm(
        `Desativar ${r.email}? O usuário perderá acesso. (Você pode reativar depois.)`
      )
    )
      return;
    setPendingUid(r.id);
    try {
      await setUserRoleDisabled(r.id, true, {
        uid: user.uid,
        email: user.email ?? "",
      });
      toast.success(`${r.email} desativado.`);
      await loadRoles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Falha ao desativar: " + msg);
    } finally {
      setPendingUid(null);
    }
  };

  const handleEnable = async (r: UserRole) => {
    if (pendingUid || !user) return;
    setPendingUid(r.id);
    try {
      await setUserRoleDisabled(r.id, false, {
        uid: user.uid,
        email: user.email ?? "",
      });
      toast.success(`${r.email} reativado.`);
      await loadRoles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Falha ao reativar: " + msg);
    } finally {
      setPendingUid(null);
    }
  };

  if (!user) return null;

  if (!canManage) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        <Shield className="mx-auto mb-3" size={32} />
        Você não tem permissão para gerenciar usuários.
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            Níveis de Acesso
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {myLevel === "L0"
              ? "Todos os tenants visíveis."
              : `Tenant: ${
                  userRole?.companyId
                    ? companyById[userRole.companyId] ?? userRole.companyId
                    : "—"
                }`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showDisabled}
              onChange={(e) => setShowDisabled(e.target.checked)}
              className="rounded"
            />
            Mostrar desativados
          </label>
          <button
            onClick={() => {
              setEditingRole(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 bg-brand-gradient text-white dark:text-black font-semibold px-4 py-2 rounded-lg shadow-md hover:opacity-90 transition-opacity"
          >
            <UserPlus size={18} /> Novo usuário
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-lidera-gray rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando…</div>
        ) : visibleRoles.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {roles.length === 0
              ? "Nenhum usuário encontrado neste escopo."
              : "Todos os usuários estão desativados. Marque \"Mostrar desativados\" pra ver."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Nível</th>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Setores</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {visibleRoles.map((r) => {
                  // Nível "declarado" no doc, ignorando disabled — útil pra
                  // mostrar mesmo em linhas desativadas.
                  const declaredLevel: AccessLevel | null = effectiveLevel(
                    { ...r, disabled: false },
                    false
                  );
                  const isPending = pendingUid === r.id;
                  const isDisabled = !!r.disabled;
                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-900/50 ${
                        isDisabled ? "opacity-60" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                        <div className="flex items-center gap-2">
                          {isDisabled && (
                            <span
                              title="Desativado"
                              className="inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                            >
                              OFF
                            </span>
                          )}
                          <span className={isDisabled ? "line-through" : ""}>
                            {r.email}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {declaredLevel ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${LEVEL_BADGE[declaredLevel]}`}
                          >
                            {declaredLevel}
                          </span>
                        ) : (
                          <span className="text-gray-400">
                            {r.role ?? "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {r.companyId
                          ? companyById[r.companyId] ?? r.companyId
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {r.sectorIds?.length
                          ? `${r.sectorIds.length} setor(es)`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleResend(r)}
                            disabled={isPending || isDisabled}
                            title={
                              isDisabled
                                ? "Reative o usuário antes de reenviar"
                                : "Reenviar email para definir/redefinir senha"
                            }
                            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Mail size={16} />
                          </button>
                          <button
                            onClick={() => handleEdit(r)}
                            disabled={isPending}
                            title="Editar nível, tenant ou setores"
                            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Pencil size={16} />
                          </button>
                          {isDisabled ? (
                            <button
                              onClick={() => handleEnable(r)}
                              disabled={isPending}
                              title="Reativar usuário"
                              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <RotateCcw size={16} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDisable(r)}
                              disabled={isPending}
                              title="Desativar usuário (pode reativar depois)"
                              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Ban size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingRole(null);
        }}
        title={editingRole ? `Editar ${editingRole.email}` : "Novo usuário"}
      >
        <UserForm
          editingRole={editingRole}
          creatorLevel={myLevel}
          creatorCompanyId={userRole?.companyId ?? null}
          creatorUser={{ uid: user.uid, email: user.email ?? "" }}
          companies={companies}
          onSuccess={() => {
            setShowForm(false);
            setEditingRole(null);
            loadRoles();
          }}
        />
      </Modal>
    </div>
  );
};

interface UserFormProps {
  /** Quando passado, o form opera em modo "editar" — email vira read-only e
   *  o submit chama updateUserRole em vez de createUserViaSecondaryApp. */
  editingRole: UserRole | null;
  creatorLevel: AccessLevel | null;
  creatorCompanyId: string | null;
  creatorUser: { uid: string; email: string };
  companies: Company[];
  onSuccess: () => void;
}

function UserForm({
  editingRole,
  creatorLevel,
  creatorCompanyId,
  creatorUser,
  companies,
  onSuccess,
}: UserFormProps) {
  const isL0 = creatorLevel === "L0";
  const isEditing = editingRole !== null;

  // Níveis permitidos: L0 cria/edita qualquer; L1 cria/edita L2/L3.
  const availableLevels: AccessLevel[] = isL0
    ? ["L0", "L1", "L2", "L3"]
    : ["L2", "L3"];

  // Nível inicial: se editando, usa o existente; senão primeiro permitido.
  const editingInitialLevel: AccessLevel | null = editingRole
    ? editingRole.level ??
      (editingRole.role === "master"
        ? "L0"
        : editingRole.role === "company"
        ? "L1"
        : null)
    : null;

  const [email, setEmail] = useState(editingRole?.email ?? "");
  const [level, setLevel] = useState<AccessLevel>(
    editingInitialLevel ?? availableLevels[0]
  );
  const [companyId, setCompanyId] = useState<string>(
    editingRole?.companyId ??
      (isL0 ? companies[0]?.id ?? "" : creatorCompanyId ?? "")
  );
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [sectorsLoading, setSectorsLoading] = useState(false);
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>(
    editingRole?.sectorIds ?? []
  );
  const [submitting, setSubmitting] = useState(false);

  // Carrega setores do tenant. Setores podem estar em um de dois schemas:
  // - Legado (SectorsView atual): `companyIds: string[]` (universal multi-tenant)
  // - Novo (qualquer doc criado já tenant-specific): `companyId: string`
  // Fazemos as duas queries e combinamos por id pra cobrir ambos durante migração.
  useEffect(() => {
    if (level !== "L3" || !companyId) {
      setSectors([]);
      setSelectedSectorIds([]);
      setSectorsLoading(false);
      return;
    }
    let cancelled = false;
    setSectorsLoading(true);
    const col = collection(db, "sectors");
    Promise.all([
      getDocs(query(col, where("companyIds", "array-contains", companyId))),
      getDocs(query(col, where("companyId", "==", companyId))),
    ])
      .then(([byArray, bySingular]) => {
        if (cancelled) return;
        const map: Record<string, Sector> = {};
        for (const d of [...byArray.docs, ...bySingular.docs]) {
          map[d.id] = { id: d.id, ...(d.data() as object) } as Sector;
        }
        const list = Object.values(map).sort((a, b) =>
          (a.name ?? "").localeCompare(b.name ?? "")
        );
        setSectors(list);
      })
      .catch((err) => {
        if (!cancelled)
          toast.error(
            "Não foi possível carregar setores: " +
              (err instanceof Error ? err.message : String(err))
          );
      })
      .finally(() => {
        if (!cancelled) setSectorsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [level, companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (level !== "L0" && !companyId) {
      toast.error("Selecione o tenant.");
      return;
    }
    if (level === "L3" && selectedSectorIds.length === 0) {
      toast.error("Selecione ao menos um setor para L3.");
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && editingRole) {
        await updateUserRole(
          editingRole.id,
          {
            level,
            companyId: level === "L0" ? null : companyId,
            sectorIds: level === "L3" ? selectedSectorIds : [],
          },
          creatorUser
        );
        toast.success(`Usuário ${editingRole.email} atualizado.`);
      } else {
        const result = await createUserViaSecondaryApp(
          {
            email: email.trim(),
            // Sem password → invite flow (sistema gera + envia reset email)
            level,
            companyId: level === "L0" ? null : companyId,
            sectorIds: level === "L3" ? selectedSectorIds : undefined,
          },
          creatorUser
        );
        toast.success(
          result.passwordResetEmailSent
            ? `Usuário criado: ${result.email} — email para definir senha enviado.`
            : `Usuário criado: ${result.email}. Falha ao enviar email — usar "Esqueci minha senha" na tela de login.`
        );
      }
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(
        (isEditing ? "Falha ao atualizar usuário: " : "Falha ao criar usuário: ") + msg
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isEditing}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:text-gray-500"
          placeholder="usuario@empresa.com.br"
        />
        <p className="text-xs text-gray-500 mt-1">
          {isEditing
            ? "Email não pode ser alterado. Para outro email, desative este e crie um novo."
            : "O usuário receberá um email com link para definir a própria senha. Você não precisa digitar nenhuma senha."}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 flex items-center gap-1">
          <Shield size={14} /> Nível de acesso
        </label>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as AccessLevel)}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800"
        >
          {availableLevels.map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABEL[l]}
            </option>
          ))}
        </select>
      </div>

      {level !== "L0" && (
        <div>
          <label className="block text-sm font-medium mb-1 flex items-center gap-1">
            <Building2 size={14} /> Tenant
          </label>
          {isL0 ? (
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800"
              required
            >
              <option value="">Selecione…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={
                companies.find((c) => c.id === companyId)?.name ?? companyId
              }
              disabled
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-500"
            />
          )}
        </div>
      )}

      {level === "L3" && (
        <div>
          <label className="block text-sm font-medium mb-1 flex items-center gap-1">
            <Layers size={14} /> Setores que lidera
          </label>
          {sectorsLoading ? (
            <p className="text-sm text-gray-500">Carregando setores do tenant…</p>
          ) : sectors.length === 0 ? (
            <div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              Nenhum setor cadastrado para este tenant. Vá em{" "}
              <strong>Configurações → Cadastros Gerais → Setores</strong> e
              cadastre os setores antes de criar líderes (L3).
            </div>
          ) : (
            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
              {sectors.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedSectorIds.includes(s.id)}
                    onChange={(e) => {
                      setSelectedSectorIds((prev) =>
                        e.target.checked
                          ? [...prev, s.id]
                          : prev.filter((id) => id !== s.id)
                      );
                    }}
                  />
                  <span className="text-sm">{s.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <button
          type="submit"
          disabled={submitting}
          className="bg-brand-gradient text-white dark:text-black font-semibold px-4 py-2 rounded-lg shadow-md hover:opacity-90 disabled:opacity-50"
        >
          {submitting
            ? isEditing
              ? "Salvando…"
              : "Criando…"
            : isEditing
            ? "Salvar alterações"
            : "Criar usuário"}
        </button>
      </div>
    </form>
  );
}
