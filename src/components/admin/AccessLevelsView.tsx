import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { UserPlus, Shield, Building2, Layers } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";
import {
  fetchCollection,
  type UserRole,
  type AccessLevel,
} from "../../services/firebase";
import {
  createUserViaSecondaryApp,
  listUserRoles,
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

/**
 * Deriva o nível de acesso efetivo do user_role legado/novo.
 * Janela de migração — quando F1.3 popular `level` em todos os docs,
 * o fallback baseado em `role` deixa de ser necessário.
 */
function effectiveLevel(role: UserRole | null): AccessLevel | null {
  if (!role) return null;
  if (role.level) return role.level;
  if (role.role === "master") return "L0";
  if (role.role === "company") return "L1";
  return null;
}

export const AccessLevelsView = () => {
  const { user, userRole } = useAuth();
  const { companies } = useCompany();

  const myLevel = effectiveLevel(userRole);
  const canManage = myLevel === "L0" || myLevel === "L1";
  const tenantFilter = myLevel === "L0" ? null : userRole?.companyId ?? null;

  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

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
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 bg-brand-gradient text-white dark:text-black font-semibold px-4 py-2 rounded-lg shadow-md hover:opacity-90 transition-opacity"
        >
          <UserPlus size={18} /> Novo usuário
        </button>
      </div>

      <div className="bg-white dark:bg-lidera-gray rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando…</div>
        ) : roles.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nenhum usuário encontrado neste escopo.
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {roles.map((r) => {
                  const lvl = effectiveLevel(r);
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                    >
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                        {r.email}
                      </td>
                      <td className="px-4 py-3">
                        {lvl ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${LEVEL_BADGE[lvl]}`}
                          >
                            {lvl}
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
        onClose={() => setShowForm(false)}
        title="Novo usuário"
      >
        <CreateUserForm
          creatorLevel={myLevel}
          creatorCompanyId={userRole?.companyId ?? null}
          creatorUser={{ uid: user.uid, email: user.email ?? "" }}
          companies={companies}
          onSuccess={() => {
            setShowForm(false);
            loadRoles();
          }}
        />
      </Modal>
    </div>
  );
};

interface CreateUserFormProps {
  creatorLevel: AccessLevel | null;
  creatorCompanyId: string | null;
  creatorUser: { uid: string; email: string };
  companies: Company[];
  onSuccess: () => void;
}

function CreateUserForm({
  creatorLevel,
  creatorCompanyId,
  creatorUser,
  companies,
  onSuccess,
}: CreateUserFormProps) {
  const isL0 = creatorLevel === "L0";

  // Níveis permitidos: L0 cria qualquer; L1 cria L2/L3.
  const availableLevels: AccessLevel[] = isL0
    ? ["L0", "L1", "L2", "L3"]
    : ["L2", "L3"];

  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<AccessLevel>(availableLevels[0]);
  const [companyId, setCompanyId] = useState<string>(
    isL0 ? companies[0]?.id ?? "" : creatorCompanyId ?? ""
  );
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Carrega setores do tenant selecionado (pra L3 escolher)
  useEffect(() => {
    if (level !== "L3" || !companyId) {
      setSectors([]);
      setSelectedSectorIds([]);
      return;
    }
    let cancelled = false;
    fetchCollection("sectors", companyId)
      .then((list) => {
        if (!cancelled) setSectors(list as Sector[]);
      })
      .catch((err) => {
        if (!cancelled)
          toast.error("Não foi possível carregar setores: " + err.message);
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
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Falha ao criar usuário: " + msg);
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
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800"
          placeholder="usuario@empresa.com.br"
        />
        <p className="text-xs text-gray-500 mt-1">
          O usuário receberá um email com link para definir a própria senha. Você não precisa digitar nenhuma senha.
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
          {sectors.length === 0 ? (
            <p className="text-sm text-gray-500">
              Carregando setores do tenant…
            </p>
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
          {submitting ? "Criando…" : "Criar usuário"}
        </button>
      </div>
    </form>
  );
}
